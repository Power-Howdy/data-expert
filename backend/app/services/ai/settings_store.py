import json
import logging
import os
import threading
from pathlib import Path
from typing import Optional

from app.core.config import settings
from app.models.ai_schemas import (
    AIProvider, AIProviderPublic, AIProviderUpdate, AISettings, AISettingsPublic, AISettingsUpdate,
)
from app.services.ai.prompts import DEFAULT_PROMPTS

logger = logging.getLogger(__name__)

LOCAL_KINDS = {"ollama", "lmstudio"}
ENV_KEYS = {"openai": "OPENAI_API_KEY", "openrouter": "OPENROUTER_API_KEY"}

DEFAULT_PROVIDERS = [
    AIProvider(id="ollama", name="Ollama (local)", kind="ollama", base_url="http://localhost:11434/v1", model="llama3.1"),
    AIProvider(id="lmstudio", name="LM Studio (local)", kind="lmstudio", base_url="http://localhost:1234/v1"),
    AIProvider(id="openai", name="OpenAI", kind="openai", base_url="https://api.openai.com/v1", model="gpt-4o-mini"),
    AIProvider(id="openrouter", name="OpenRouter", kind="openrouter", base_url="https://openrouter.ai/api/v1"),
]


def default_settings() -> AISettings:
    return AISettings(
        active_provider_id="ollama",
        providers=[p.model_copy() for p in DEFAULT_PROVIDERS],
        prompts=DEFAULT_PROMPTS.model_copy(),
    )


def resolve_api_key(provider: AIProvider) -> str:
    """Stored key, falling back to the provider's conventional environment variable."""
    if provider.api_key:
        return provider.api_key
    env = ENV_KEYS.get(provider.kind)
    return os.environ.get(env, "") if env else ""


def is_configured(provider: Optional[AIProvider]) -> bool:
    if not provider or not provider.base_url or not provider.model:
        return False
    return provider.kind in LOCAL_KINDS or provider.kind == "custom" or bool(resolve_api_key(provider))


class AISettingsStore:
    """AI configuration persisted as JSON next to the dataset registry."""

    def __init__(self, path: Optional[str] = None):
        self.path = Path(path) if path else Path(settings.data.registry_path).parent / "ai_settings.json"
        self._lock = threading.RLock()
        self._settings = self._load()

    def _load(self) -> AISettings:
        if not self.path.exists():
            return default_settings()
        try:
            return AISettings(**json.loads(self.path.read_text(encoding="utf-8")))
        except (OSError, ValueError) as e:
            logger.warning(f"Could not read AI settings, using defaults: {e}")
            return default_settings()

    def get(self) -> AISettings:
        with self._lock:
            return self._settings.model_copy(deep=True)

    def active_provider(self) -> Optional[AIProvider]:
        current = self.get()
        return next((p for p in current.providers if p.id == current.active_provider_id), None)

    def find_provider(self, provider_id: str) -> Optional[AIProvider]:
        return next((p for p in self.get().providers if p.id == provider_id), None)

    def merge_provider(self, update: AIProviderUpdate) -> AIProvider:
        """Apply the keep/clear/replace api_key rule against the stored provider."""
        stored = self.find_provider(update.id)
        api_key = update.api_key if update.api_key is not None else (stored.api_key if stored else None)
        return AIProvider(**{**update.model_dump(), "api_key": api_key or None})

    def update(self, update: AISettingsUpdate) -> AISettings:
        with self._lock:
            providers = [self.merge_provider(p) for p in update.providers]
            if not any(p.id == update.active_provider_id for p in providers):
                raise ValueError("Active provider must be one of the configured providers")
            self._settings = AISettings(
                active_provider_id=update.active_provider_id,
                providers=providers,
                model=update.model,
                prompts=update.prompts,
            )
            self._save()
            return self.get()

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._settings.model_dump(mode="json"), indent=2), encoding="utf-8")
        os.replace(tmp, self.path)

    def public(self) -> AISettingsPublic:
        current = self.get()
        providers = [
            AIProviderPublic(
                **{**p.model_dump(), "api_key": None},
                has_api_key=bool(resolve_api_key(p)),
                api_key_hint=f"…{p.api_key[-4:]}" if p.api_key and len(p.api_key) > 8 else "",
            )
            for p in current.providers
        ]
        return AISettingsPublic(
            active_provider_id=current.active_provider_id,
            providers=providers,
            model=current.model,
            prompts=current.prompts,
            default_prompts=DEFAULT_PROMPTS,
            configured=is_configured(self.active_provider()),
        )


ai_settings_store = AISettingsStore()
