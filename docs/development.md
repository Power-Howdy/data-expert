# Development

## Setup

```bash
git clone <repo-url> data-expert
cd data-expert

# Backend
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m app.main              # http://localhost:8000

# Frontend (second terminal)
cd frontend
npm install
npm run dev                     # http://127.0.0.1:5173
```

`python -m app.main` runs without auto-reload. For reload while editing the backend:

```bash
uvicorn app.main:app --reload --port 8000
```

Restart the backend after changing services: singletons such as the registry and version control keep state in
memory.

## Tests

```bash
cd backend
pytest                # all tests
pytest tests/test_versioning.py -q
```

| File | Covers |
|------|--------|
| `tests/test_editing.py` | Pending edits, type coercion, replace, transforms, commit |
| `tests/test_versioning.py` | Commits, reverse deltas, snapshots, restore, diff, external changes |
| `tests/test_search.py` | Direct scan and the background index (forced by lowering `SCAN_LIMIT_BYTES`) |
| `tests/test_ai_pipeline.py` | JSON parsing, built-ins, sandbox, plan checks, the no-data-to-model guarantee, save-as |

Tests use temporary folders and a stub LLM client; they need no network and no AI provider.

Frontend checks:

```bash
cd frontend
npm run typecheck
npm run build
```

CI (`.github/workflows/ci.yml`) runs the backend tests and the frontend build on every push and pull request.

## Code style

### Backend

- Python 3.14, type hints on public functions, Pydantic v2 models for every request and response.
- Keep data lazy: work with `pl.LazyFrame` and collect only what a response needs (a page, a count, a sample).
  Never collect a whole dataset in a request path.
- Services are module-level singletons (`dataset_manager`, `manipulation_engine`, `version_control`, ...). Routes
  stay thin: validate, call a service, map exceptions to HTTP errors.
  - `KeyError` → 404
  - `ValueError`, `TypeError`, `PolarsError` → 400
  - `FileExistsError` → 409
- Write files atomically: write a temporary file next to the target, then `os.replace`.
- Error messages are shown to users; make them readable and actionable.
- Nothing that sends data to an AI provider may include rows beyond the configured, truncated samples. Add a test
  when touching prompts or context building.
- Docstrings explain *why* or constraints; avoid comments that restate code.

### Frontend

See the [Frontend guide](frontend.md). In short: reusable components, at most 100 lines per component file, logic
in hooks, all HTTP in `src/lib`.

### Commits and pull requests

- Small, focused pull requests with a clear description and screenshots for UI changes.
- Conventional-style commit subjects are welcome (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`), but not
  required.
- Update the docs in `docs/` and the in-app guide (`guideContent.ts`) when behavior changes.
- Add an entry under *Unreleased* in [CHANGELOG.md](../CHANGELOG.md).

## Common tasks

### Add an API endpoint

1. Add request/response models in `app/models/`.
2. Implement the logic in a service under `app/services/`.
3. Add the route in `app/main.py` or a router in `app/api/` (include new routers in `main.py`).
4. Add the client call in `frontend/src/lib/` and types in `frontend/src/types/`.
5. Document it in [api-reference.md](api-reference.md).

### Add a built-in function to the AI library

1. Pick the module in `app/services/functions/builtin/` (`rows`, `columns`, `text`, `reshape`, `enrich`). A new
   module must be imported in `builtin/__init__.py` so its functions register.
2. Write `def my_function(lf, schema, p)` returning a `LazyFrame`, decorated with `@builtin(...)` and declaring
   typed parameters with `P(...)`. Column-typed parameters are validated against the schema automatically.
3. Give it a precise `purpose`, `input` and `output`: the planner chooses functions from these one-line
   descriptions.
4. Add a case to `tests/test_ai_pipeline.py::test_builtin_functions`.

### Add a file format

1. Reading: `DataLoader` in `app/services/data_loader.py` (lazy scan where Polars supports it).
2. Writing: `write_frame` in `app/services/versioning/service.py` (used by commits and restores),
   `app/services/export.py` and `app/services/save_as.py`.
3. Add the extension to `allowed_extensions` in `config.yaml` and `core/config.py`, and to `DataFormat` in
   `models/schemas.py`.

## Debugging tips

- `http://localhost:8000/docs` lets you call any endpoint by hand.
- Version history is plain files: inspect `<data folder>/.data-expert-history/<file>/history.json`.
- Search index state: `GET /api/search/indexing`.
- On Windows, "file in use" errors on commit usually mean something holds the data file open (an index, a viewer,
  Excel). The backend drops its own search index before replacing a file.

## Releasing

1. Update the version in `frontend/package.json` and in `backend/app/main.py` (the FastAPI app and
   `/api/health`). The footer shows the version reported by `/api/health`.
2. Move *Unreleased* entries in `CHANGELOG.md` to a new version section.
3. Tag the release: `git tag v1.x.y && git push --tags`, then create a GitHub release with the changelog section.
