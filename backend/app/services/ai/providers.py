"""Known OpenAI-compatible providers. A provider's `kind` is the id of its preset, or "custom"."""
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel

AuthStyle = Literal["bearer", "anthropic", "azure"]


class ProviderPreset(BaseModel):
    id: str
    name: str
    base_url: str
    model: str = ""
    local: bool = False
    env_key: str = ""
    auth: AuthStyle = "bearer"
    key_url: str = ""
    note: str = ""


PRESETS: List[ProviderPreset] = [
    # Local servers
    ProviderPreset(id="ollama", name="Ollama", base_url="http://localhost:11434/v1", model="llama3.1", local=True),
    ProviderPreset(id="lmstudio", name="LM Studio", base_url="http://localhost:1234/v1", local=True),
    ProviderPreset(id="llamacpp", name="llama.cpp server", base_url="http://localhost:8080/v1", local=True),
    ProviderPreset(
        id="vllm", name="vLLM", base_url="http://localhost:8001/v1", local=True,
        note="vLLM defaults to port 8000, which the Data Expert backend uses; start it with --port 8001.",
    ),
    ProviderPreset(id="jan", name="Jan", base_url="http://localhost:1337/v1", local=True),
    ProviderPreset(id="localai", name="LocalAI", base_url="http://localhost:8080/v1", local=True),
    # Cloud providers
    ProviderPreset(id="openai", name="OpenAI", base_url="https://api.openai.com/v1", model="gpt-4o-mini",
                   env_key="OPENAI_API_KEY", key_url="https://platform.openai.com/api-keys"),
    ProviderPreset(id="anthropic", name="Anthropic (Claude)", base_url="https://api.anthropic.com/v1",
                   model="claude-haiku-4-5", env_key="ANTHROPIC_API_KEY", auth="anthropic",
                   key_url="https://console.anthropic.com/settings/keys"),
    ProviderPreset(id="gemini", name="Google Gemini", base_url="https://generativelanguage.googleapis.com/v1beta/openai",
                   model="gemini-2.5-flash", env_key="GEMINI_API_KEY", key_url="https://aistudio.google.com/apikey"),
    ProviderPreset(id="openrouter", name="OpenRouter", base_url="https://openrouter.ai/api/v1",
                   model="openai/gpt-4o-mini", env_key="OPENROUTER_API_KEY", key_url="https://openrouter.ai/keys"),
    ProviderPreset(id="azure", name="Azure OpenAI", base_url="https://YOUR-RESOURCE.openai.azure.com/openai/v1",
                   env_key="AZURE_OPENAI_API_KEY", auth="azure",
                   note="Replace YOUR-RESOURCE and use your deployment name as the model."),
    ProviderPreset(id="mistral", name="Mistral AI", base_url="https://api.mistral.ai/v1", model="mistral-small-latest",
                   env_key="MISTRAL_API_KEY", key_url="https://console.mistral.ai/api-keys"),
    ProviderPreset(id="groq", name="Groq", base_url="https://api.groq.com/openai/v1", model="llama-3.3-70b-versatile",
                   env_key="GROQ_API_KEY", key_url="https://console.groq.com/keys"),
    ProviderPreset(id="deepseek", name="DeepSeek", base_url="https://api.deepseek.com/v1", model="deepseek-chat",
                   env_key="DEEPSEEK_API_KEY", key_url="https://platform.deepseek.com/api_keys"),
    ProviderPreset(id="xai", name="xAI (Grok)", base_url="https://api.x.ai/v1", model="grok-3-mini",
                   env_key="XAI_API_KEY", key_url="https://console.x.ai"),
    ProviderPreset(id="together", name="Together AI", base_url="https://api.together.xyz/v1",
                   model="meta-llama/Llama-3.3-70B-Instruct-Turbo", env_key="TOGETHER_API_KEY",
                   key_url="https://api.together.ai/settings/api-keys"),
    ProviderPreset(id="fireworks", name="Fireworks AI", base_url="https://api.fireworks.ai/inference/v1",
                   model="accounts/fireworks/models/llama-v3p3-70b-instruct", env_key="FIREWORKS_API_KEY",
                   key_url="https://fireworks.ai/account/api-keys"),
    ProviderPreset(id="cerebras", name="Cerebras", base_url="https://api.cerebras.ai/v1", model="llama-3.3-70b",
                   env_key="CEREBRAS_API_KEY", key_url="https://cloud.cerebras.ai"),
    ProviderPreset(id="perplexity", name="Perplexity", base_url="https://api.perplexity.ai", model="sonar",
                   env_key="PERPLEXITY_API_KEY", key_url="https://www.perplexity.ai/settings/api"),
    ProviderPreset(id="cohere", name="Cohere", base_url="https://api.cohere.ai/compatibility/v1",
                   model="command-a-03-2025", env_key="COHERE_API_KEY", key_url="https://dashboard.cohere.com/api-keys"),
    ProviderPreset(id="nvidia", name="NVIDIA NIM", base_url="https://integrate.api.nvidia.com/v1",
                   model="meta/llama-3.3-70b-instruct", env_key="NVIDIA_API_KEY", key_url="https://build.nvidia.com"),
    ProviderPreset(id="huggingface", name="Hugging Face", base_url="https://router.huggingface.co/v1",
                   model="meta-llama/Llama-3.3-70B-Instruct", env_key="HF_TOKEN",
                   key_url="https://huggingface.co/settings/tokens"),
]
PRESETS_BY_ID: Dict[str, ProviderPreset] = {p.id: p for p in PRESETS}
DEFAULT_PRESET_IDS = ["ollama", "lmstudio", "openai", "anthropic", "gemini", "openrouter"]


def preset_for(kind: str) -> Optional[ProviderPreset]:
    return PRESETS_BY_ID.get(kind)


def is_local(kind: str) -> bool:
    preset = preset_for(kind)
    return bool(preset and preset.local)
