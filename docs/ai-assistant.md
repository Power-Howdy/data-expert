# AI assistant

The AI assistant turns plain-language requests into data transformations, and writes summaries of dataset
profiles. It is built around one rule: **the dataset is never sent to the model.**

Code: `backend/app/services/ai/` and `backend/app/services/functions/`.

## Privacy

| Sent to the provider | Never sent |
|----------------------|------------|
| Column names and types | The dataset, or any bulk export of rows |
| Row count and per-column profile hints (null %, unique count, min/max) | Files, paths outside the prompt |
| A few sample rows with each value truncated to 160 characters (plans; configurable, 0–50, default 5) | API keys of other providers |
| For insights: the cached profile summary (top values truncated to 80 characters, correlations) and 3 truncated sample rows | |
| Your request text and the function catalog | |

Model output is never executed as-is on your data:

- A **plan** is a list of calls to library functions with parameters. It is validated and test-run on a local
  200-row sample before you see it.
- A **new function** written by the model is AST-checked by the sandbox and tested on the sample before it is
  added to the library.
- Running a plan on the full data happens locally in a background job, with no model calls.

For complete privacy, use a local model server. Then nothing leaves your machine at all.

The test `tests/test_ai_pipeline.py::test_plan_generates_function_without_sending_data` puts a secret value in a
dataset outside the sampled rows, and asserts that it never appears in any message sent to the model.

## Providers

Any OpenAI-compatible chat completions API works. Presets (in `services/ai/providers.py`):

| Local | Cloud |
|-------|-------|
| Ollama, LM Studio, llama.cpp server, vLLM, Jan, LocalAI | OpenAI, Anthropic, Google Gemini, OpenRouter, Azure OpenAI, Mistral, Groq, DeepSeek, xAI, Together, Fireworks, Cerebras, Perplexity, Cohere, NVIDIA NIM, Hugging Face |

For any other OpenAI-compatible server, choose **Other OpenAI-compatible endpoint**.

Configure providers with the sparkle button in the top bar:

1. Under **Add a provider**, pick a preset or a custom endpoint.
2. Set the base URL, the model (**Load models** lists them from the server) and an API key for cloud providers.
3. **Test connection** sends a short prompt and reports latency.
4. Choose the active provider and save.

### API keys

- Keys are stored in `backend/.data_expert/ai_settings.json` on the backend machine. Never commit this file; it
  is ignored by `.gitignore`.
- The API never returns stored keys to the browser, only whether a key is set and its last four characters.
- If no key is stored, the backend reads the preset's conventional environment variable, for example
  `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `MISTRAL_API_KEY`,
  `GROQ_API_KEY` or `HF_TOKEN`.

### Model settings

| Setting | Default | Meaning |
|---------|---------|---------|
| Temperature | 0.2 | Used for insights; plans and functions use 0 |
| Max tokens | 2048 | Reply limit |
| Timeout | 120 s | Per request |
| JSON mode | off | Send `response_format: json_object` (only for servers that support it) |
| Disable thinking | on | For local/custom servers, sends `chat_template_kwargs.enable_thinking=false`; `<think>` blocks are always stripped |
| Sample rows | 5 | Sample rows included in plan prompts (0–50) |

Replies are parsed tolerantly: code fences, surrounding prose and missing closing brackets (common with small
models) are handled.

### Prompts

The system, planner, function-writer and insights prompts can be edited in AI settings. Clearing a prompt restores
its default (`services/ai/prompts.py`).

## Transform pipeline

```
request ──► planner ──► plan (steps) ──► check on 200-row sample ──► preview in UI
                │                                        │
                └─► generator (new function, if needed) ─┘
run ──► background job on full data ──► view ──► refine / save as file / apply as pending change
```

### 1. Plan: `POST /api/ai/plan`

The planner sends the model:

- the system and planner prompts and the plan output format;
- the function catalog, one line per function: name, typed parameters, purpose, input and output;
- the dataset description (schema, profile hints, samples) and the request.

The reply has an `explanation`, `steps` (`function` and `params`), and optionally `new_functions` it needs.
Requested functions are generated first, then the plan is checked:

- every function exists;
- required parameters are present;
- `column`/`columns` parameters name real columns and `enum` values are valid;
- the steps run without error on the sample.

If the check fails, the error is sent back to the model for one corrected attempt.

### 2. Run: `POST /api/ai/apply`

Starts a background job (poll `GET /api/ai/jobs/{id}`, cancel with `POST /api/ai/jobs/{id}/cancel`). The job
rechecks the plan, chains the steps lazily on the full dataset (or on a parent view, for refinements) and stores
the result as a **view**.

### 3. Views

Views are in-memory derived datasets (up to 50), paged in cached 1,000-row windows. A view can be:

- browsed and filtered (`GET /api/views/{id}/rows`);
- refined: plan again with `view_id` set, which creates a child view;
- saved to a new file (`POST /api/datasets/{id}/save-as` with `view_id`);
- applied (`POST /api/views/{id}/apply`): its whole lineage of steps becomes one pending `transform` on the
  dataset, saved to the file on the next commit.

Views are dropped when the dataset is saved, restored or unloaded.

## Function library

The library is what the planner can call. `GET /api/ai/functions` lists it.

### Built-in functions

| Category | Functions |
|----------|-----------|
| Rows | `filter_rows`, `filter_range`, `filter_keywords`, `drop_nulls`, `dedupe`, `sort_rows`, `top_n`, `limit_rows`, `sample_rows` |
| Columns | `select_columns`, `drop_columns`, `rename_columns`, `cast_column`, `fill_missing`, `replace_values` |
| Text | `extract_pattern`, `extract_field`, `text_metric`, `transform_text`, `replace_text`, `split_text`, `concat_columns` |
| Reshape | `explode_list`, `unnest_struct`, `group_aggregate`, `value_counts` |
| Enrich | `keyword_tag`, `keyword_score`, `weighted_score`, `completeness_score`, `flag_rows`, `bucketize` |

Built-ins live in `services/functions/builtin/` and are registered with the `@builtin` decorator in
`registry.py`, which declares typed parameters (`column`, `columns`, `new_column`, `string`, `number`, `integer`,
`boolean`, `enum`, `list`, `mapping`, `regex`, `any`).

### Generated functions

When no built-in fits, the model writes one:

```python
def run(lf, params):
    return lf.with_columns(
        pl.col(params["column"]).str.split(" ").list.len().alias(params["target"])
    )
```

Generated functions are stored in `backend/.data_expert/functions.json`, shown in the Function library panel with
their source and use count, and can be deleted there. Steps that use one embed its spec, so saved transforms and
version history replay identically even after the function is deleted.

### Sandbox

`services/functions/sandbox.py` checks generated code before compiling it:

- The code must define `run(lf, params)` returning a `LazyFrame`; only functions and constants are allowed at
  the top level.
- No imports, classes, `global`/`nonlocal`, `with`, async code, `yield` or `del`.
- No dangerous names (`eval`, `exec`, `open`, `getattr`, `type`, `print`, ...) and no name starting with `_`.
- No attributes that do I/O or escape the lazy plan: anything starting with `_`, `read_`, `scan_`, `write_` or
  `sink_`, and `collect`, `sql`, `to_pandas`, `plugins` and similar.
- Builtins are limited to a safe set. Available helpers: `pl`, `re`, `math`, `json` and a few expression helpers.

This contains model mistakes in a local, single-user tool. **It is not a hardened security boundary**; do not
expose the backend to untrusted users. See [SECURITY.md](../SECURITY.md).

## Insights

`POST /api/datasets/{id}/ai/insights` with an optional `focus` turns the cached profile into a Markdown summary
(data quality, notable distributions, correlations, suggested next steps). A profile must be generated first on
the Stats tab. Insights are cached per dataset until the data changes; `GET` returns the cached one.

## Testing without a provider

Backend tests replace `LLMClient` with a stub that records messages, so the pipeline is tested offline. For manual
testing, run any local server, for example `llama-server -m model.gguf --port 8081`, and add a custom provider
with base URL `http://localhost:8081/v1`.
