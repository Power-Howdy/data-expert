from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from app.models.schemas import ColumnSchema, FilterParams


# ==================== Settings ====================

ProviderKind = Literal["openai", "openrouter", "ollama", "lmstudio", "custom"]


class AIProvider(BaseModel):
    id: str
    name: str
    kind: ProviderKind = "custom"
    base_url: str
    api_key: Optional[str] = None
    model: str = ""


class AIModelSettings(BaseModel):
    temperature: float = Field(0.2, ge=0, le=2)
    max_tokens: int = Field(2048, ge=16, le=200_000)
    timeout_seconds: int = Field(120, ge=5, le=3600)
    json_mode: bool = False
    max_ai_rows: int = Field(100, ge=1, le=100_000)
    batch_size: int = Field(10, ge=1, le=200)
    concurrency: int = Field(2, ge=1, le=32)


class AIPrompts(BaseModel):
    system: str
    planner: str
    row_task: str
    insights: str


class AISettings(BaseModel):
    active_provider_id: str
    providers: List[AIProvider]
    model: AIModelSettings = AIModelSettings()
    prompts: AIPrompts


class AIProviderPublic(AIProvider):
    """Provider as sent to the browser: the key itself is never returned."""
    api_key: Optional[str] = None
    has_api_key: bool = False
    api_key_hint: str = ""


class AISettingsPublic(BaseModel):
    active_provider_id: str
    providers: List[AIProviderPublic]
    model: AIModelSettings
    prompts: AIPrompts
    default_prompts: AIPrompts
    configured: bool


class AIProviderUpdate(BaseModel):
    """api_key: None keeps the stored key, "" clears it, anything else replaces it."""
    id: str
    name: str
    kind: ProviderKind = "custom"
    base_url: str
    api_key: Optional[str] = None
    model: str = ""


class AISettingsUpdate(BaseModel):
    active_provider_id: str
    providers: List[AIProviderUpdate]
    model: AIModelSettings
    prompts: AIPrompts


class ProviderTestRequest(BaseModel):
    provider: AIProviderUpdate


class ProviderTestResponse(BaseModel):
    ok: bool
    latency_ms: int = 0
    reply: str = ""
    error: str = ""


# ==================== Transform plans ====================

class PlanStep(BaseModel):
    op: str
    description: str = ""
    params: Dict[str, Any] = Field(default_factory=dict)


class TransformPlan(BaseModel):
    explanation: str = ""
    steps: List[PlanStep] = Field(default_factory=list)
    ai_rows: int = 0
    warnings: List[str] = Field(default_factory=list)


class PlanRequest(BaseModel):
    dataset_id: str
    prompt: str
    view_id: Optional[str] = None


class ApplyPlanRequest(BaseModel):
    dataset_id: str
    plan: TransformPlan
    prompt: str = ""
    view_id: Optional[str] = None


class ViewInfo(BaseModel):
    id: str
    dataset_id: str
    parent_view_id: Optional[str] = None
    prompt: str = ""
    steps: List[PlanStep] = Field(default_factory=list)
    columns_schema: List[ColumnSchema] = Field(default_factory=list, alias="schema")
    total: int = 0
    notes: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)

    model_config = {"populate_by_name": True}


class JobStatus(BaseModel):
    id: str
    status: Literal["running", "done", "error", "cancelled"] = "running"
    done: int = 0
    total: int = 0
    message: str = ""
    error: str = ""
    view: Optional[ViewInfo] = None


# ==================== Save as dataset ====================

class SaveAsRequest(BaseModel):
    name: str
    format: Literal["parquet", "jsonl", "csv", "json"] = "parquet"
    view_id: Optional[str] = None
    filters: List[FilterParams] = Field(default_factory=list)
    overwrite: bool = False


# ==================== Insights ====================

class InsightsRequest(BaseModel):
    focus: str = ""


class AIInsights(BaseModel):
    dataset_id: str
    markdown: str
    focus: str = ""
    model: str = ""
    generated_at: datetime = Field(default_factory=datetime.now)
