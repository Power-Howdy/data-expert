# API reference

The backend serves a REST API under `/api` on port 8000. Interactive OpenAPI docs with request and response schemas
are at `http://localhost:8000/docs` (Swagger UI) and `http://localhost:8000/redoc`.

Conventions:

- JSON bodies and responses. Errors return `{"detail": "..."}` with status 400 (bad input), 404 (unknown dataset,
  row or version) or 409 (conflict, such as an existing file or pending changes).
- `{id}` is a dataset id, as returned by `POST /api/datasets/load`.
- `filters` and `sorts` query parameters are JSON-encoded arrays:
  - filter: `{"column": "price", "operator": "gte", "value": 10}`. Operators: `eq`, `ne`, `gt`, `gte`, `lt`,
    `lte`, `contains`, `startswith`, `endswith`, `in`, `not_in`, `is_null`, `is_not_null`.
  - sort: `{"column": "price", "ascending": false}`.
- There is no authentication. See [SECURITY.md](../SECURITY.md).

## Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | `{"status": "healthy", "version": "1.0.0"}` |

## Folders and datasets

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/directories/pick` | Open a native folder dialog on the backend machine; returns `{"path"}` |
| GET | `/api/directories/tree?path=&max_depth=3` | Tree of folders and supported files |
| POST | `/api/directories/scan` | Find data files: `{"path", "recursive": true, "max_depth"}` |
| GET | `/api/datasets` | Loaded datasets |
| GET | `/api/datasets/{id}` | One dataset: schema, row count, size, stats |
| POST | `/api/datasets/load` | Load a file: `{"path", "name"?, "format"?, "options"?}` |
| DELETE | `/api/datasets/{id}` | Unload; drops cached profile, insights, views and pending changes. The file is untouched |

## Rows

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/datasets/{id}/rows?offset=&limit=&filters=&sorts=` | A page of rows, including pending edits (`limit` ≤ 10,000) |
| GET | `/api/datasets/{id}/rows/{row_id}` | One row |
| GET | `/api/datasets/{id}/schema` | Columns and types |
| GET | `/api/datasets/{id}/stream?offset=&chunk_size=` | Server-Sent Events: one `row` event per row, then `complete` |

## Editing (pending until committed)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/datasets/{id}/rows` | Add a row: `{"data": {...}}` |
| PUT | `/api/datasets/{id}/rows/{row_id}` | Update fields: `{"data": {...}}`; only changed fields are recorded |
| DELETE | `/api/datasets/{id}/rows/{row_id}` | Delete a row |
| POST | `/api/datasets/{id}/replace/preview` | Count matches of a find & replace |
| POST | `/api/datasets/{id}/replace` | Find & replace: `{"column", "old_value", "new_value", "mode": "exact"\|"contains"\|"regex", "case_sensitive"}` |
| POST | `/api/datasets/{id}/transform` | Apply function-library steps: `{"operations": [{"op", "params"}], "description"}` |
| GET | `/api/datasets/{id}/changes` | Summary of pending changes |
| POST | `/api/datasets/{id}/changes/undo` | Drop the most recent pending change |
| POST | `/api/datasets/{id}/discard` | Drop all pending changes |
| POST | `/api/datasets/{id}/commit` | Write changes to the file as a new version: `{"message"?}`; returns the commit |
| POST | `/api/datasets/{id}/save-as` | Write the dataset or a view to a new file: `{"name", "format", "view_id"?, "filters"?, "overwrite"?}` |

## Version history

Prefix: `/api/datasets/{id}/versions`. A `{ref}` is a commit id, a unique prefix of at least 4 characters, or a tag.

| Method | Path | Description |
|--------|------|-------------|
| GET | `` (prefix only) | History: `tracking`, `head`, commits (newest first), tags, storage |
| POST | `/init` | Start tracking (records a baseline) |
| GET | `/diff?a=&b=&rows=false` | Compare two versions; `rows=true` adds a row-level diff with samples |
| GET | `/{ref}/rows?offset=&limit=` | Page through a version (read-only) |
| POST | `/{ref}/restore` | Make a version current (new commit). 409 if changes are pending |
| POST | `/{ref}/save-as` | Write a version to a new file: `{"name", "format", "overwrite"?}` |
| POST | `/tags` | Tag a commit: `{"name", "commit_id"}` |
| DELETE | `/tags/{name}` | Remove a tag |
| PUT | `/settings` | `{"keep_snapshots": 0..100}` |
| DELETE | `` (prefix only) | Delete the whole history of the file (the data file is kept) |

## Search

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/datasets/{id}/search` | `{"query", "columns"?, "limit": 100, "offset": 0}` → results, `total`, `total_exact` (false when `total` is a lower bound), `mode` (`scan`/`index`), `index` status |
| GET | `/api/datasets/{id}/search/status` | Index status: `state`, `indexed`, `total`, `size_bytes`, `error` |
| POST | `/api/datasets/{id}/search/index` | Start building the index |
| GET | `/api/search/indexing` | Builds in progress (or failed), by dataset id |
## Browse copy

An optional copy of a large file with small row groups, so every page loads quickly. See
[Architecture](architecture.md#request-flow-browsing-a-page).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/datasets/{id}/browse-copy` | Status: `state` (`missing`/`building`/`ready`/`error`), `needed` (deep pages are slow without one), `done`, `total`, `size_bytes`, `error` |
| POST | `/api/datasets/{id}/browse-copy` | Start building the copy in the background; returns the status |
| DELETE | `/api/datasets/{id}/browse-copy` | Cancel a build and delete the copy; returns the status |

## Analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/datasets/{id}/stats` | Overview: rows, columns, memory, missing, duplicates |
| GET | `/api/datasets/{id}/profile?sample_size=&refresh=false` | Full profile (cached; computed if missing or `refresh=true`) |
| GET | `/api/datasets/{id}/profile/saved` | Cached profile or `null` |
| GET | `/api/datasets/{id}/distributions/{column}?bins=50` | Histogram or top values |
| GET | `/api/datasets/{id}/outliers/{column}?method=iqr&threshold=1.5` | Outliers (`iqr` or `zscore`) |

## Combine and separate

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/datasets/combine` | `{"dataset_ids", "strategy": "concat"\|"join"\|"merge", "join_config"?, "output_name", "output_format"}` |
| POST | `/api/datasets/combine/preview` | Same inputs plus `limit`; returns preview rows |
| POST | `/api/datasets/separate` | Split by a column's values: `{"dataset_id", "column", "output_dir", "output_format"}` |

## Export

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/export/formats` | Formats with compression and partitioning support |
| POST | `/api/datasets/{id}/export` | Write a file: `{"format", "columns"?, "filters"?, "compression"?, "partition_by"?, "output_path"?}` |
| GET | `/api/datasets/{id}/export/stream?format=&columns=&compression=` | Stream the export as a download |

## AI

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ai/settings` | Providers (keys redacted), model settings, prompts, presets, `configured` |
| PUT | `/api/ai/settings` | Save settings. Per provider, `api_key: null` keeps the stored key, `""` clears it, a value replaces it |
| POST | `/api/ai/models` | List models of a provider: `{"provider": {...}}` |
| POST | `/api/ai/test` | Test a provider: `ok`, `latency_ms`, `reply`, `error` |
| POST | `/api/ai/plan` | Build a plan: `{"dataset_id", "prompt", "view_id"?}` |
| POST | `/api/ai/apply` | Run a plan in the background: `{"dataset_id", "plan", "prompt", "view_id"?}` → job |
| GET | `/api/ai/jobs/{job_id}` | Job progress; `view` is set when done |
| POST | `/api/ai/jobs/{job_id}/cancel` | Cancel a job |
| GET | `/api/ai/functions` | Function library |
| DELETE | `/api/ai/functions/{name}` | Delete a generated function |
| GET | `/api/views/{view_id}` | View info: lineage, schema, total |
| GET | `/api/views/{view_id}/rows?offset=&limit=&filters=` | Page through a view |
| DELETE | `/api/views/{view_id}` | Discard a view |
| POST | `/api/views/{view_id}/apply` | Record the view's steps as a pending transform of its dataset |
| GET | `/api/datasets/{id}/ai/insights` | Cached insights or `null` |
| POST | `/api/datasets/{id}/ai/insights` | Generate insights: `{"focus"?}` |

## Example

```bash
# Load a file
curl -X POST localhost:8000/api/datasets/load \
  -H "Content-Type: application/json" -d '{"path": "/data/reviews.parquet"}'

# Rows with a filter
curl -G localhost:8000/api/datasets/$ID/rows \
  --data-urlencode 'limit=20' \
  --data-urlencode 'filters=[{"column":"rating","operator":"gte","value":4}]'

# Edit a row and save it as a version
curl -X PUT localhost:8000/api/datasets/$ID/rows/42 \
  -H "Content-Type: application/json" -d '{"data": {"rating": 5}}'
curl -X POST localhost:8000/api/datasets/$ID/commit \
  -H "Content-Type: application/json" -d '{"message": "Fix rating of row 42"}'
```
