import json
from typing import Any, Dict, List, Optional

from app.models.ai_schemas import AIInsights
from app.models.schemas import DatasetProfile
from app.services.ai.client import AIError, LLMClient
from app.services.ai.settings_store import ai_settings_store
from app.services.data_loader import dataset_manager
from app.services.profile_store import insights_store, profile_store

TOP_VALUES = 5
VALUE_CHARS = 80
SAMPLE_ROWS = 3


def _short(value: Any) -> Any:
    text = value if isinstance(value, str) else json.dumps(value, default=str, ensure_ascii=False)
    return text[:VALUE_CHARS] + "…" if len(text) > VALUE_CHARS else value


def _column_summary(c) -> Dict[str, Any]:
    summary: Dict[str, Any] = {
        "name": c.name, "type": c.type.value,
        "null_pct": round(c.null_percentage, 2), "unique": c.unique_count,
    }
    for key in ("min", "max", "mean", "std", "median"):
        value = getattr(c, key)
        if value is not None:
            summary[key] = round(value, 4) if isinstance(value, float) else _short(value)
    if c.top_values and c.unique_percentage < 90:
        summary["top_values"] = [{"value": _short(t["value"]), "count": t["count"]} for t in c.top_values[:TOP_VALUES]]
    return summary


def _strong_correlations(profile: DatasetProfile) -> List[str]:
    pairs, seen = [], set()
    for a, row in (profile.correlations or {}).items():
        for b, r in row.items():
            if a != b and abs(r) >= 0.3 and (b, a) not in seen:
                seen.add((a, b))
                pairs.append(f"{a} ~ {b}: r={r:.2f}")
    return pairs[:15]


def build_context(dataset_id: str, profile: DatasetProfile) -> str:
    dataset = dataset_manager.get_dataset(dataset_id)
    lf = dataset_manager.get_dataframe(dataset_id)
    stats = dataset.stats
    sample = [{k: _short(v) for k, v in r.items()} for r in lf.head(SAMPLE_ROWS).collect().to_dicts()]
    context = {
        "dataset": dataset.name,
        "format": dataset.format.value,
        "rows": dataset.row_count,
        "profiled_rows": profile.row_count,
        "missing_pct": round(stats.missing_percentage, 2) if stats else None,
        "duplicate_rows": stats.duplicate_rows if stats else None,
        "columns": [_column_summary(c) for c in profile.columns],
        "strong_correlations": _strong_correlations(profile),
        "sample_rows": sample,
    }
    return json.dumps(context, ensure_ascii=False, default=str, indent=1)


def get_saved_insights(dataset_id: str) -> Optional[AIInsights]:
    dataset = dataset_manager.get_dataset(dataset_id)
    return insights_store.load(dataset) if dataset else None


def generate_insights(dataset_id: str, focus: str = "") -> AIInsights:
    dataset = dataset_manager.get_dataset(dataset_id)
    if not dataset:
        raise ValueError(f"Dataset {dataset_id} not found")
    profile = profile_store.load(dataset)
    if not profile:
        raise AIError("Generate a profile first; insights are based on it.")
    current = ai_settings_store.get()
    client = LLMClient.from_settings()
    request = f"Dataset profile (JSON):\n{build_context(dataset_id, profile)}"
    if focus.strip():
        request += f"\n\nFocus especially on: {focus.strip()}"
    markdown = client.chat([
        {"role": "system", "content": f"{current.prompts.system}\n\n{current.prompts.insights}"},
        {"role": "user", "content": request},
    ])
    insights = AIInsights(dataset_id=dataset_id, markdown=markdown.strip(), focus=focus.strip(), model=client.provider.model)
    insights_store.save(dataset, insights)
    return insights
