import json
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Dict, List, Optional, Tuple

import polars as pl

from app.models.ai_schemas import AIModelSettings, AIPrompts
from app.services.ai.client import AIError, LLMClient

IDX = "__dx_idx"
VAL = "__dx_val"
MAX_FIELD_CHARS = 2000
OUTPUT_DTYPES = {"number": pl.Float64, "boolean": pl.Boolean, "list": pl.List(pl.String), "string": pl.String}

Progress = Callable[[int, int], None]
Cancelled = Callable[[], bool]


def missing_expr(schema: pl.Schema, column: str) -> pl.Expr:
    expr = pl.col(column).is_null()
    if schema[column] == pl.String:
        expr = expr | (pl.col(column).str.strip_chars() == "")
    return expr


def _field(value: Any) -> Any:
    text = value if isinstance(value, str) else json.dumps(value, default=str, ensure_ascii=False)
    return text[:MAX_FIELD_CHARS] + "…" if len(text) > MAX_FIELD_CHARS else value


def coerce(value: Any, output_type: str) -> Any:
    if value is None:
        return None
    try:
        if output_type == "number":
            return float(value)
        if output_type == "boolean":
            return value if isinstance(value, bool) else str(value).strip().lower() in ("true", "yes", "1", "y")
        if output_type == "list":
            items = value if isinstance(value, list) else [value]
            return [i if isinstance(i, str) else json.dumps(i, ensure_ascii=False) for i in items]
    except (TypeError, ValueError):
        return None
    return value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)


class RowTask:
    """Ask the model for one value per row, a batch of rows per request."""

    def __init__(self, client: LLMClient, prompts: AIPrompts, instruction: str, output_type: str):
        self.client = client
        self.system = f"{prompts.system}\n\n{prompts.row_task}"
        self.instruction = instruction
        self.output_type = output_type

    def _ask(self, items: List[Dict[str, Any]]) -> Dict[int, Any]:
        user = (
            f"Instruction: {self.instruction}\n"
            f"Output type for value: {self.output_type}\n"
            'Return ONLY a JSON array with one object per row, in the same order: [{"id": <row id>, "value": ...}]\n'
            f"Rows:\n{json.dumps(items, ensure_ascii=False, default=str)}"
        )
        reply = self.client.chat_json([{"role": "system", "content": self.system}, {"role": "user", "content": user}])
        if isinstance(reply, dict):
            reply = reply.get("results") or reply.get("rows") or ([reply] if "value" in reply else [])
        if not isinstance(reply, list):
            raise AIError("Expected a JSON array of results")
        results = {r.get("id"): r.get("value") for r in reply if isinstance(r, dict)}
        if len(items) == 1 and len(reply) == 1 and items[0]["id"] not in results:
            results = {items[0]["id"]: reply[0].get("value") if isinstance(reply[0], dict) else reply[0]}
        return results

    def run_batch(self, items: List[Dict[str, Any]]) -> Dict[int, Any]:
        try:
            return self._ask(items)
        except AIError:
            if len(items) == 1:
                raise
        merged: Dict[int, Any] = {}
        for item in items:
            try:
                merged.update(self._ask([item]))
            except AIError:
                continue
        return merged


def run_ai_column(
    lf: pl.LazyFrame, params: Dict[str, Any], client: LLMClient, prompts: AIPrompts,
    model: AIModelSettings, progress: Progress, cancelled: Cancelled,
) -> Tuple[pl.LazyFrame, Optional[str]]:
    schema = lf.collect_schema()
    target, sources = params["new_column"], list(params.get("columns") or [])
    output_type = params.get("output_type", "string")
    only_missing = bool(params.get("only_missing")) and target in schema
    sources = sources or ([target] if target in schema else [])

    indexed = lf.with_row_index(IDX)
    candidates = indexed.filter(missing_expr(schema, target)) if only_missing else indexed
    available = candidates.select(pl.len()).collect().item()
    batch_df = candidates.head(model.max_ai_rows).select([IDX, *sources]).collect()
    items = [{"id": int(r.pop(IDX)), **{k: _field(v) for k, v in r.items()}} for r in batch_df.to_dicts()]

    task = RowTask(client, prompts, params.get("instruction", ""), output_type)
    results = _run_batches(task, items, model, progress, cancelled)

    dtype = OUTPUT_DTYPES.get(output_type, pl.String)
    values = [coerce(results.get(i["id"]), output_type) for i in items]
    res = pl.DataFrame({IDX: pl.Series([i["id"] for i in items], dtype=batch_df[IDX].dtype), VAL: pl.Series(values, dtype=dtype, strict=False)})
    joined = indexed.join(res.lazy(), on=IDX, how="left", maintain_order="left")
    if only_missing:
        fill = pl.when(missing_expr(schema, target) & pl.col(VAL).is_not_null())
        joined = joined.with_columns(fill.then(pl.col(VAL).cast(schema[target], strict=False)).otherwise(pl.col(target)).alias(target))
    else:
        joined = joined.with_columns(pl.col(VAL).alias(target))
    note = f"AI processed {len(items):,} of {available:,} rows for '{target}' (limit {model.max_ai_rows:,})." if available > len(items) else None
    return joined.drop(IDX, VAL), note


def _run_batches(task: RowTask, items: List[Dict[str, Any]], model: AIModelSettings, progress: Progress, cancelled: Cancelled) -> Dict[int, Any]:
    batches = [items[i:i + model.batch_size] for i in range(0, len(items), model.batch_size)]
    results: Dict[int, Any] = {}
    errors: List[str] = []
    done = 0
    progress(0, len(items))

    def work(batch: List[Dict[str, Any]]) -> Tuple[int, Dict[int, Any]]:
        if cancelled():
            return len(batch), {}
        try:
            return len(batch), task.run_batch(batch)
        except AIError as e:
            errors.append(str(e))
            return len(batch), {}

    with ThreadPoolExecutor(max_workers=model.concurrency) as pool:
        for size, batch_results in pool.map(work, batches):
            results.update(batch_results)
            done += size
            progress(done, len(items))
    if not results and items and not cancelled():
        raise AIError(errors[0] if errors else "The model returned no usable results for any row")
    return results
