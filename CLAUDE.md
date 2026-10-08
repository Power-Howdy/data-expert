# Rules for AI Agents

Data Expert is a local-first dataset workbench: a FastAPI + Polars backend (`backend/`) and a React + TypeScript +
Vite frontend (`frontend/`). Read [docs/architecture.md](docs/architecture.md) before larger changes.

## Non-negotiable

- **Never send dataset rows to AI providers.** Models may receive only the schema, summary statistics and the
  configured, truncated sample rows. Plans and generated functions run locally. Any change to prompts or context
  building (`backend/app/services/ai/`) needs a test like `test_plan_generates_function_without_sending_data`.
- **Do not create fake or mock LLM servers** for manual testing. Use a real local server (for example llama.cpp on
  `http://localhost:8081/v1`). Unit tests may stub `LLMClient`, as `tests/test_ai_pipeline.py` does.
- Never commit user data, `backend/.data_expert/` (it holds API keys) or `.data-expert-history/`.

## Backend

- Python 3.14, FastAPI, Pydantic v2, Polars 2, Tantivy. Run from `backend/`: `python -m app.main` (reads
  `config.yaml` from the working directory). Tests: `cd backend && pytest`.
- Keep data lazy: work with `pl.LazyFrame` and collect only what a response needs (a page, a count, a sample).
  Never collect a whole dataset in a request path; files can be many gigabytes.
- Routes are thin (`app/main.py`, `app/api/*`): validate, call a service, and map exceptions to HTTP errors
  (`KeyError` → 404; `ValueError`/`TypeError`/`PolarsError` → 400; `FileExistsError` → 409). Logic lives in
  `app/services/`, as module-level singletons.
- Pydantic models for every request and response (`app/models/`).
- Edits are pending operations applied lazily (`services/changes.py`, hidden row id `__dx_row`). Files change only
  on commit, through `services/versioning/service.py`: temporary file, then `os.replace`.
- Version history lives in `<data folder>/.data-expert-history/<file>/` and is linear. Row edits store reverse
  deltas; transforms store hardlinked snapshots. See [docs/version-control.md](docs/version-control.md).
- Opening a file must stay instant: `get_stats` reads metadata (Parquet footer), never the data, for large files.
  Plain row pages go through `services/row_cache.py`. Its streaming readers hold files open, so call
  `row_cache.release(path)` before replacing a data file. Opt-in browse copies (`services/browse_copy.py`) are
  read instead when they match the file; `browse_copies.delete(id)` stops a build that holds the file open.
- Search: files under 256 MB are scanned with Polars (including pending edits); larger files use a background
  Tantivy index. Call `search_engine.delete_index` before replacing a data file, because Windows locks open files.
- Generated AI functions must pass `services/functions/sandbox.py`. New built-ins go in
  `services/functions/builtin/` with `@builtin(...)`.
- Endpoints are sync functions (thread pool); protect shared state with locks.
- Error messages are shown to users: make them readable and actionable.

## Frontend

- All React Components should be reusable.
- All React Components files should not contain more than 100 lines.
- Put feature logic in hooks (`useXxx.ts`) and keep components presentational: props in, callbacks out.
- Shared building blocks go in `src/components/common/`; Radix wrappers in `src/components/ui/`. Reuse them
  before writing new ones.
- All HTTP goes through `src/lib/*Api.ts` (axios); types in `src/types/`. Long calls use `timeout: 0`.
- Global state in zustand stores (`src/stores/`); keep local state local.
- Icons: `lucide-react` 0.303 (no `CircleHelp`; use `HelpCircle`).
- Check with `cd frontend && npm run typecheck`. On networks that intercept TLS, npm needs
  `NODE_OPTIONS=--use-system-ca`.
- When user-visible behavior changes, update the in-app guide (`src/components/guide/guideContent.ts`).

## Documentation

- User and developer docs live in `docs/` (index: [docs/README.md](docs/README.md)). Update the relevant page and
  [docs/api-reference.md](docs/api-reference.md) when behavior or endpoints change.
- Add notable changes under *Unreleased* in `CHANGELOG.md`.
