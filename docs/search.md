# Search

Search finds rows that contain all the query words in any column. It has two strategies, chosen by file size.

Code: `backend/app/services/search_engine.py`.

## Semantics

- Every word in the query must match (AND), case-insensitively.
- All columns are searched. Nested values (lists, structs) are searched as JSON text, without the column-name
  prefixes, so a query matches values rather than field names.
- Results are paged with `offset` and `limit`. `limit` is capped by `search.max_results` in `config.yaml`.
  The response includes the total match count and highlighted snippets.

## Small files: direct scan

Files under 256 MB (`SCAN_LIMIT_BYTES`) are searched with a Polars scan over the dataset *including pending edits*.
Values keep their types, and results reflect unsaved changes immediately. Results are in file order, and the
request's optional `columns` list limits which columns are searched. Typical response times are well under a
second.

## Large files: background index

Scanning a multi-gigabyte file takes tens of seconds per query, so larger files are indexed with
[Tantivy](https://github.com/quickwit-oss/tantivy-py), a Rust full-text engine:

1. The first search (or `POST /search/index`) starts a background build and returns at once. The response has
   `mode: "index"` and an `index` status with `state` (`missing`, `building`, `ready`, `error`), `indexed` and
   `total`.
2. The build reads the file in batches of 20,000 rows. Each document stores:
   - `pos`: the row position;
   - `text`: all values as searchable text (indexed, not stored);
   - `row`: the row as JSON, so results come back without re-reading the data file.
3. The frontend polls `GET /search/status` every 1.5 s, re-runs the query when the index is ready, and shows
   progress as a ring next to the dataset in the sidebar (`GET /api/search/indexing` lists all active builds).
4. Queries are parsed leniently, with conjunction by default, and results are ranked by relevance. If nothing
   matches, a fuzzy query (edit distance 1) is tried.
5. Pending deletes and updates are overlaid on index results. A pending *transform* makes index results invalid;
   search then asks you to save or discard first.

Indexes are stored in `settings.search.index_path/<dataset id>/v2-<size>-<mtime>/`. The folder name includes the
file size and modification time, so an index is never used for a changed file. A `dx-meta.json` marker records
a completed build.

Saving or restoring a dataset deletes its index, and any running build is cancelled first. The index is rebuilt
on the next search. Builds run in memory, so a backend restart interrupts them; the next search starts over.

## Tuning

| Constant | Default | Meaning |
|----------|---------|---------|
| `SCAN_LIMIT_BYTES` | 256 MB | Files at or above this size use the index |
| `BATCH_ROWS` | 20,000 | Rows per indexing batch |
| `MAX_WRITER_HEAP` | 512 MB | Tantivy writer memory |

They are module constants in `search_engine.py`. The index location is configurable in `config.yaml`
(`search.index_path`).

## Suggestions

`GET /search/suggest?q=` returns indexed terms that start with `q`. It is available only for files that have an
index.
