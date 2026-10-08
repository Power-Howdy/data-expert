import json
import re
import time
from typing import Any, Dict, List, Optional

import httpx

from app.models.ai_schemas import AIModelSettings, AIProvider
from app.services.ai.settings_store import ai_settings_store, is_configured, resolve_api_key


class AIError(Exception):
    """Provider or response problem, with a message that is safe to show the user."""


def _headers(provider: AIProvider) -> Dict[str, str]:
    headers = {"Content-Type": "application/json"}
    key = resolve_api_key(provider)
    if key:
        headers["Authorization"] = f"Bearer {key}"
    if provider.kind == "openrouter":
        headers["X-Title"] = "Data Expert"
    return headers


def _error_detail(response: httpx.Response) -> str:
    try:
        body = response.json()
        error = body.get("error", body)
        return error.get("message", str(error)) if isinstance(error, dict) else str(error)
    except ValueError:
        return response.text[:300]


def parse_json(text: str) -> Any:
    """Parse JSON from a model reply, tolerating code fences and surrounding prose."""
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.IGNORECASE)
    try:
        return json.loads(cleaned)
    except ValueError:
        pass
    for open_char, close_char in (("{", "}"), ("[", "]")):
        start, end = cleaned.find(open_char), cleaned.rfind(close_char)
        if start != -1 and end > start:
            try:
                return json.loads(cleaned[start:end + 1])
            except ValueError:
                continue
    raise AIError("The model did not return valid JSON")


class LLMClient:
    def __init__(self, provider: AIProvider, model_settings: AIModelSettings):
        if not provider.base_url:
            raise AIError(f"Provider '{provider.name}' has no base URL")
        self.provider = provider
        self.settings = model_settings
        self.base_url = provider.base_url.rstrip("/")

    @classmethod
    def from_settings(cls) -> "LLMClient":
        provider = ai_settings_store.active_provider()
        if not is_configured(provider):
            raise AIError("AI is not configured. Open AI settings to choose a provider, model and API key.")
        return cls(provider, ai_settings_store.get().model)

    def chat(
        self, messages: List[Dict[str, str]], json_output: bool = False,
        max_tokens: Optional[int] = None, temperature: Optional[float] = None,
    ) -> str:
        if not self.provider.model:
            raise AIError(f"Choose a model for provider '{self.provider.name}'")
        payload: Dict[str, Any] = {
            "model": self.provider.model,
            "messages": messages,
            "temperature": self.settings.temperature if temperature is None else temperature,
            "max_tokens": max_tokens or self.settings.max_tokens,
        }
        if json_output and self.settings.json_mode:
            payload["response_format"] = {"type": "json_object"}
        try:
            response = httpx.post(
                f"{self.base_url}/chat/completions", json=payload,
                headers=_headers(self.provider), timeout=self.settings.timeout_seconds,
            )
        except httpx.TimeoutException:
            raise AIError(f"The model did not answer within {self.settings.timeout_seconds}s")
        except httpx.HTTPError as e:
            raise AIError(f"Could not reach {self.base_url}: {e}")
        if response.status_code >= 400:
            raise AIError(f"Provider error {response.status_code}: {_error_detail(response)}")
        try:
            return response.json()["choices"][0]["message"]["content"] or ""
        except (ValueError, KeyError, IndexError, TypeError):
            raise AIError("Unexpected response format from provider")

    def chat_json(self, messages: List[Dict[str, str]], **kwargs) -> Any:
        return parse_json(self.chat(messages, json_output=True, **kwargs))

    def list_models(self) -> List[str]:
        try:
            response = httpx.get(f"{self.base_url}/models", headers=_headers(self.provider), timeout=15)
        except httpx.HTTPError as e:
            raise AIError(f"Could not reach {self.base_url}: {e}")
        if response.status_code >= 400:
            raise AIError(f"Provider error {response.status_code}: {_error_detail(response)}")
        data = response.json()
        items = data.get("data", data.get("models", [])) if isinstance(data, dict) else data
        names = [m.get("id") or m.get("name") for m in items if isinstance(m, dict)]
        return sorted(n for n in names if n)

    def ping(self) -> Dict[str, Any]:
        started = time.perf_counter()
        reply = self.chat([{"role": "user", "content": "Reply with the single word: OK"}], max_tokens=16, temperature=0)
        return {"latency_ms": int((time.perf_counter() - started) * 1000), "reply": reply.strip()[:200]}
