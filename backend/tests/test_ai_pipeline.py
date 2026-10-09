"""AI pipeline tests with a fake model; run from the backend directory: python -m pytest tests"""
import time

import polars as pl
import pytest

from app.models.ai_schemas import ApplyPlanRequest, PlanStep, SaveAsRequest, StepsRequest, TransformPlan
from app.models.schemas import LoadDatasetRequest
from app.services.ai.client import AIError, parse_json
from app.services.ai.executor import start_apply
from app.services.ai.jobs import job_manager
from app.services.ai.planner import check_plan, plan_transform
from app.services.data_loader import dataset_manager
from app.services.functions.library import function_library
from app.services.functions.sandbox import SandboxError, compile_function
from app.services.functions.steps import preview_steps, run_steps
from app.services.save_as import save_as_dataset

SECRET = "SECRET-ROW-NEVER-SENT"
COUNT_WORDS = {
    "title": "Count words", "category": "transform", "purpose": "Count words in a text column",
    "params": [{"name": "column", "type": "column"}, {"name": "new_column", "type": "new_column"}],
    "example": {"column": "text", "new_column": "n_words"},
    "code": "def run(lf, params):\n    schema = lf.collect_schema()\n"
            "    return lf.with_columns(size_expr(schema, params['column'], True).alias(params['new_column']))",
}


class FakeLLM:
    """Stands in for LLMClient; records every message so tests can assert what would reach a provider."""
    plan_reply: dict = {}
    seen: list = []

    def __init__(self, *args, **kwargs):
        self.provider = type("P", (), {"model": "fake"})()

    @classmethod
    def from_settings(cls):
        return cls()

    def chat_json(self, messages, **kwargs):
        FakeLLM.seen.append("\n".join(m["content"] for m in messages))
        return COUNT_WORDS if "Write this function" in messages[-1]["content"] else FakeLLM.plan_reply


@pytest.fixture()
def dataset(tmp_path, monkeypatch):
    monkeypatch.setattr(dataset_manager, "registry_path", tmp_path / "datasets.json")
    monkeypatch.setattr(dataset_manager, "datasets", {})
    monkeypatch.setattr(dataset_manager, "dataframes", {})
    monkeypatch.setattr(dataset_manager, "options", {})
    monkeypatch.setattr(function_library, "path", tmp_path / "functions.json")
    monkeypatch.setattr(function_library, "_generated", {})
    for module in ("app.services.ai.planner", "app.services.ai.insights"):
        monkeypatch.setattr(f"{module}.LLMClient", FakeLLM)
    FakeLLM.seen = []
    texts = ["mail me at a@b.com", "call +1 555 123 4567", None, "short", "x@y.org and z@w.io here"]
    texts += [f"filler row {i}" for i in range(15)] + [SECRET]
    path = tmp_path / "people.parquet"
    pl.DataFrame({"text": texts, "tokens": list(range(len(texts)))}).write_parquet(path)
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
    assert parse_json('{"code": "def run(lf, params):\n    return lf", "p": [{"a": "x\\"}"}]') == {
        "code": "def run(lf, params):\n    return lf", "p": [{"a": 'x"}'}]}
    with pytest.raises(AIError):
        parse_json("no json here")


def test_builtin_functions():
    lf = pl.LazyFrame({"text": ["a@b.com hi there about football", None, "stock market"], "n": [3, 1, 2]})
    out = function_library.apply(lf, "extract_pattern", {"column": "text", "new_column": "emails", "preset": "email"})
    out = function_library.apply(out, "keyword_tag", {
        "column": "text", "new_column": "topic", "categories": {"sport": ["football"], "finance": ["stock"]}})
    out = function_library.apply(out, "top_n", {"column": "n", "n": 2}).collect()
    assert out["n"].to_list() == [3, 2]
    assert out["emails"].to_list()[0] == ["a@b.com"] and out["topic"].to_list() == ["sport", "finance"]


def test_sandbox_rejects_unsafe_code():
    for code in ("import os\ndef run(lf, params): return lf", "def run(lf, params): return lf.__class__",
                 "def run(lf, params): return pl.read_csv('x')", "def run(lf, params): return open('x')",
                 "def run(lf, params): return lf.collect()"):
        with pytest.raises(SandboxError):
            compile_function(code)


def test_check_plan_reports_bad_params():
    plan = TransformPlan(steps=[PlanStep(op="top_n", params={"column": "missing"})])
    with pytest.raises(AIError, match="unknown column"):
        check_plan(plan, pl.DataFrame({"text": ["a"]}))


def test_plan_generates_function_without_sending_data(dataset):
    FakeLLM.plan_reply = {"explanation": "x", "steps": [
        {"function": "filter_rows", "params": {"column": "text", "operator": "is_not_null"}},
        {"function": "extract_pattern", "params": {"column": "text", "new_column": "emails", "preset": "email"}},
        {"function": "count_words", "params": {"column": "text", "new_column": "n_words"}},
    ], "new_functions": [{"name": "count_words", "purpose": "Count words", "params": []}]}
    plan = plan_transform(dataset.id, "do it")
    assert plan.new_functions == ["count_words"] and function_library.get("count_words").source == "generated"
    assert FakeLLM.seen and not any(SECRET in m for m in FakeLLM.seen)

    status = wait(start_apply(ApplyPlanRequest(dataset_id=dataset.id, plan=plan, prompt="do it")).id)
    assert status.status == "done", status.error
    assert status.view.total == 20 and {"emails", "n_words"} <= {c.name for c in status.view.columns_schema}
    saved = save_as_dataset(dataset.id, SaveAsRequest(name="enriched", view_id=status.view.id))
    df = pl.read_parquet(saved.path)
    assert df["n_words"].to_list()[0] == 4 and df["emails"].to_list()[3] == ["x@y.org", "z@w.io"]


def test_manual_steps_preview_and_run_without_a_model(dataset, monkeypatch):
    def no_model(*args, **kwargs):
        raise AssertionError("manual steps must not call a model")

    monkeypatch.setattr(FakeLLM, "chat_json", no_model)
    steps = [
        PlanStep(op="filter_rows", params={"column": "text", "operator": "contains", "value": "@"}),
        PlanStep(op="extract_pattern", params={"column": "text", "new_column": "emails", "preset": "email"}),
    ]
    request = StepsRequest(dataset_id=dataset.id, steps=steps, description="emails")
    preview = preview_steps(request)
    assert preview.sample_rows == 21 and preview.result_rows == 2
    assert preview.rows[1]["emails"] == ["x@y.org", "z@w.io"] and "emails" in {c.name for c in preview.columns}

    status = wait(run_steps(request).id)
    assert status.status == "done", status.error
    assert status.view.total == 2 and status.view.prompt == "emails"

    with pytest.raises(ValueError, match="unknown column"):
        preview_steps(StepsRequest(dataset_id=dataset.id, steps=[PlanStep(op="top_n", params={"column": "nope"})]))
    with pytest.raises(ValueError, match="at least one step"):
        run_steps(StepsRequest(dataset_id=dataset.id))


def test_save_as_filters_and_refuses_overwrite(dataset):
    request = SaveAsRequest(name="big", format="jsonl", filters=[{"column": "tokens", "operator": "gt", "value": "3"}])
    saved = save_as_dataset(dataset.id, request)
    assert saved.row_count == 17
    with pytest.raises(FileExistsError):
        save_as_dataset(dataset.id, request)
