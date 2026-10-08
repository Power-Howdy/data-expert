# Architecture

## Overview

```
┌──────────────────────────── Browser ────────────────────────────┐
│ React + TypeScript (Vite)                                       │
│ Sidebar · Browse · Stats · History · Export · Combine · Guide   │
│ zustand stores · axios clients (api, editApi, aiApi, versionApi)│
└───────────────────────────────┬─────────────────────────────────┘
                                │ REST (JSON), SSE for streams
┌───────────────────────────────▼─────────────────────────────────┐
│ FastAPI backend (app/main.py, app/api/*)                        │
│                                                                 │
│  data_loader ── dataset registry, lazy Polars frames            │
│  manipulation ─ pending edits (changes.py) applied lazily       │
│  versioning ─── commits, reverse deltas, snapshots, rebuild     │
│  search_engine  Polars scan (small) / Tantivy index (large)     │
│  analytics ──── profiles, distributions, outliers               │
│  ai/ ────────── planner, executor, generator, insights, views   │
│  functions/ ─── built-in + generated function library, sandbox  │
│  export · combine · save_as · directory_scanner                 │
└───────────────┬───────────────────────────────┬─────────────────┘
                │                               │ HTTPS (schema, stats, samples only)
      Local file system                  AI provider (optional)
  data files · .data-expert-history/     local server or cloud API
  backend/.data_expert/ (app state)
```

## Design principles

1. **Local first.** Files are read and written in place on the user's machine. There is no database and no upload.
2. **Lazy by default.** Datasets are Polars `LazyFrame`s. Pages, filters, profiles and exports push work down to
   the scan, so a multi-gigabyte file never has to fit in memory just to be shown.
3. **Edits are pending until saved.** Changes are kept as a list of operations and applied on top of the lazy
   frame. The file changes only on commit, through a temporary file and an atomic rename.
4. **Every save is a version.** Commits store the minimum needed to go one version back (a reverse delta for row
   edits, a hardlinked snapshot for transforms), so history stays small even for huge files.
5. **Data never goes to AI providers.** Models see the schema, statistics and a few truncated sample values. Model
   output is a plan of library function calls (or AST-checked code for a new function) that runs locally.

## Backend

Entry point: `backend/app/main.py`. It creates the FastAPI app, CORS and GZip middleware, the core routes, and
includes `api/ai_routes.py` and `api/version_routes.py`. Services are module-level singletons, imported where
needed.

| Module | Responsibility |
|--------|----------------|
| `core/config.py` | Settings from `config.yaml`, overridable with environment variables |
| `models/schemas.py` | Core Pydantic models: datasets, rows, filters, search, analytics, export |
| `models/ai_schemas.py`, `function_schemas.py`, `version_schemas.py` | Models of the AI, function library and version APIs |
| `services/data_loader.py` | `DataLoader` reads every format lazily; `DatasetManager` keeps the registry (`.data_expert/datasets.json`) |
| `services/directory_scanner.py` | Builds the folder tree of supported files |
| `services/changes.py` | Applies pending operations to a lazy frame using a hidden row id column |
| `services/manipulation.py` | Row paging, filtering and sorting; records pending edits; commits through version control |
| `services/versioning/` | `repository.py` (on-disk layout), `deltas.py` (reverse deltas), `rebuild.py` (rebuild any version), `service.py` (`VersionControl`) |
| `services/search_engine.py` | Full-text search: direct scan or background Tantivy index |
| `services/analytics.py` | Overview, profiles (sampled), correlations, missing matrix, distributions, outliers |
| `services/profile_store.py` | Caches profiles and AI insights per dataset, keyed by a file fingerprint |
| `services/ai/` | LLM client and provider presets, settings store, planner, function generator, executor, background jobs, views, insights |
| `services/functions/` | Function library: built-ins (`builtin/`), shared expressions, sandbox for generated code |
| `services/export.py`, `combine.py`, `save_as.py` | Writing data to new files |

### Request flow: browsing a page

1. `GET /api/datasets/{id}/rows?offset=&limit=&filters=&sorts=` reaches `manipulation_engine.get_rows`.
2. The registry returns the cached `LazyFrame` for the dataset.
3. Pending edits are applied lazily (`changes.py`), then filters, sorts and the slice.
4. Polars collects only the requested slice; rows are returned with their stable row id.

### Request flow: saving edits

1. `POST /api/datasets/{id}/commit` with an optional message.
2. The search index for the dataset is dropped; open files block renames on Windows.
3. `VersionControl.commit_edits` creates a baseline version if the file is not tracked yet (or records an external
   change), computes the reverse delta, writes the new data to a temporary file, keeps a snapshot if needed,
   atomically replaces the file and records the commit.
4. Pending edits are cleared and the dataset is reloaded.

Details: [Editing and pending changes](editing.md) and [Version history](version-control.md).

### Request flow: AI transform

1. `POST /api/ai/plan`: the planner describes the dataset (schema, profile hints, truncated samples), sends the
   function catalog and the request to the model, validates the returned plan on a 200-row local sample, and
   retries once with the error if it is invalid.
2. `POST /api/ai/apply`: a background job runs the plan on the full data and creates an in-memory **view**.
   The browser polls `GET /api/ai/jobs/{id}`.
3. The view can be browsed, refined, saved as a new file, or applied to the dataset as a pending transform.

Details: [AI assistant](ai-assistant.md).

### Concurrency

Endpoints are synchronous functions; FastAPI runs them in a thread pool. Shared state is protected with locks
(`RLock` in version control, the settings store and the function library). Search index builds and AI jobs run
on background threads and report progress through polling endpoints.

## Frontend

A Vite + React + TypeScript single-page app. See the [Frontend guide](frontend.md).

- **State:** zustand stores (`useStore` for app and UI state, persisted; `useEditStore`, `useAIStore`,
  `useIndexingStore`).
- **API:** axios clients in `src/lib/` (`api.ts`, `editApi.ts`, `aiApi.ts`, `versionApi.ts`). The base URL comes
  from `VITE_API_URL` (default `/api`, proxied by Vite).
- **UI:** Radix primitives wrapped in `components/ui/`, shared building blocks in `components/common/`, and one
  folder per feature.

## Persistent state

| Location | Contents |
|----------|----------|
| `backend/.data_expert/datasets.json` | Registry of loaded datasets |
| `backend/.data_expert/ai_settings.json` | AI providers, API keys, model settings, prompts |
| `backend/.data_expert/functions.json` | Generated library functions |
| `backend/.data_expert/profiles/`, `insights/` | Cached profiles and AI insights |
| `backend/.data_expert/search_indexes/` | Tantivy indexes of large files |
| `<data folder>/.data-expert-history/<file>/` | Version history of each tracked file |

None of this belongs in version control; all of it is in `.gitignore`.
