"""AI pipeline tests with a fake model; run from the backend directory: python -m pytest tests"""
import json
import time

import polars as pl
import pytest

from app.models.ai_schemas import ApplyPlanRequest, PlanStep, SaveAsRequest, TransformPlan
from app.models.schemas import LoadDatasetRequest
from app.services.ai.client import AIError, parse_json
from app.services.ai.executor import start_apply
from app.services.ai.jobs import job_manager
from app.services.ai.operations import apply_operation
from app.services.ai.planner import plan_transform, validate_plan
from app.services.ai.settings_store import ai_settings_store
from app.services.data_loader import dataset_manager
from app.services.save_as import save_as_dataset


class FakeLLM:
    """Stands in for LLMClient: plans from a canned reply, enriches rows deterministically."""
    plan_reply: dict = {}

    def __init__(self, *args, **kwargs):
        self.provider = type("P", (), {"model": "fake"})()

    @classmethod
    def from_settings(cls):
        return cls()

    def chat_json(self, messages, **kwargs):
        user = messages[-1]["content"]
        if "Rows:\n" not in user:
            return FakeLLM.plan_reply
        rows = json.loads(user.split("Rows:\n", 1)[1])
        return [{"id": r["id"], "value": "long" if len(str(r.get("text", ""))) > 12 else "short"} for r in rows]


@pytest.fixture()
def dataset(tmp_path, monkeypatch):
    monkeypatch.setattr(dataset_manager, "registry_path", tmp_path / "datasets.json")
    monkeypatch.setattr(dataset_manager, "datasets", {})
    monkeypatch.setattr(dataset_manager, "dataframes", {})
    monkeypatch.setattr(dataset_manager, "options", {})
    for module in ("app.services.ai.planner", "app.services.ai.executor", "app.services.ai.insights"):
        monkeypatch.setattr(f"{module}.LLMClient", FakeLLM)
    path = tmp_path / "people.parquet"
    pl.DataFrame({
        "text": ["mail me at a@b.com", "call +1 555 123 4567", None, "short", "x@y.org and z@w.io here"],
        "tokens": [4, 5, 0, 1, 6],
    }).write_parquet(path)
    return dataset_manager.load_dataset(LoadDatasetRequest(path=str(path)))


def wait(job_id: str):
    for _ in range(200):
        status = job_manager.get(job_id)
        if status.status != "running":
            return status
        time.sleep(0.02)
    raise TimeoutError(job_id)


def test_parse_json_tolerates_fences_and_prose():
    assert parse_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert parse_json('Sure! [1, 2] done') == [1, 2]
    with pytest.raises(AIError):
        parse_json("no json here")


def test_deterministic_operations():
    lf = pl.LazyFrame({"text": ["a@b.com hi there", None, "one"], "n": [3, 1, 2]})
    out = apply_operation(lf, "extract", {"column": "text", "new_column": "emails", "preset": "email"})
    out = apply_operation(out, "filter", {"column": "text", "operator": "words_gt", "value": 1})
    out = apply_operation(out, "derive", {"column": "text", "new_column": "len", "function": "length"}).collect()
    assert out["emails"].to_list() == [["a@b.com"]] and out["len"].to_list() == [16]
    typed = apply_operation(lf, "filter", {"column": "n", "operator": "gte", "value": "2"}).collect()
    assert typed.height == 2


def test_validate_plan_rejects_unknown_columns():
    plan = TransformPlan(steps=[PlanStep(op="sort", params={"column": "missing"})])
    with pytest.raises(AIError, match="unknown column"):
        validate_plan(plan, ["text"], 10, 5)


def test_plan_apply_view_and_save(dataset, tmp_path):
    FakeLLM.plan_reply = {"explanation": "x", "steps": [
        {"op": "filter", "params": {"column": "text", "operator": "is_not_null"}},
        {"op": "extract", "params": {"column": "text", "new_column": "emails", "preset": "email"}},
        {"op": "ai_column", "params": {"new_column": "size", "columns": ["text"], "instruction": "size", "output_type": "string"}},
    ]}
    plan = plan_transform(dataset.id, "do it")
    assert plan.ai_rows == 5
    status = wait(start_apply(ApplyPlanRequest(dataset_id=dataset.id, plan=plan, prompt="do it")).id)
    assert status.status == "done", status.error
    view = status.view
    assert view.total == 4 and {"emails", "size"} <= {c.name for c in view.columns_schema}

    saved = save_as_dataset(dataset.id, SaveAsRequest(name="enriched", view_id=view.id))
    df = pl.read_parquet(saved.path)
    assert df["size"].to_list() == ["long", "long", "short", "long"]
    assert df["emails"].to_list()[-1] == ["x@y.org", "z@w.io"]


def test_ai_fill_missing_respects_row_cap(dataset, monkeypatch):
    model = ai_settings_store.get().model.model_copy(update={"max_ai_rows": 1})
    monkeypatch.setattr(ai_settings_store, "get", lambda: ai_settings_store._settings.model_copy(update={"model": model}))
    plan = TransformPlan(steps=[PlanStep(op="ai_column", params={
        "new_column": "text", "columns": ["tokens"], "instruction": "fill", "only_missing": True})])
    status = wait(start_apply(ApplyPlanRequest(dataset_id=dataset.id, plan=plan)).id)
    assert status.status == "done", status.error
    assert status.view.total == 5


def test_save_as_filters_and_refuses_overwrite(dataset):
    request = SaveAsRequest(name="big", format="jsonl", filters=[{"column": "tokens", "operator": "gt", "value": "3"}])
    saved = save_as_dataset(dataset.id, request)
    assert saved.row_count == 3
    with pytest.raises(FileExistsError):
        save_as_dataset(dataset.id, request)
