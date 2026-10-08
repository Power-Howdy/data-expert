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

## Large files: compact block index

Scanning a multi-gigabyte file takes tens of seconds per query, so larger files get a small index that tells
search which parts of the file can contain the query, and only those parts are scanned. Results are exactly those
of a full scan (same case-insensitive substring matching as small files).

How it works:

- The rows are split into blocks of at least 10,000 rows (`MIN_BLOCK_ROWS`), aligned with browse-copy row groups.
- For each block the index keeps a 1-Mbit (128 KB) fingerprint: a Bloom-style bit set of every 2- and 3-byte
  snippet in the block's lowercased text. Blocks are made large enough that each fingerprint is under 1/200 of the
  data it covers (`DATA_PER_FINGERPRINT`), so the whole index is about 1/200–1/250 of the file. For a 3 GB,
  1M-row file it is 13 MB, down from 14.8 GB with the previous Tantivy index.
- A query keeps the blocks whose fingerprint has every snippet of every word, then reads and scans those blocks
  in parallel (6 threads) in file order. Words that appear nowhere are answered from the fingerprints alone, in
  milliseconds.
- Once a page of results is full, counting continues for at most 1 s (`COUNT_BUDGET_S`). If it stops early,
  `total_exact` is `false` and `total` is a lower bound (the UI shows “1,234+”).
- Blocks are read from the [browse copy](user-guide.md#browsing-rows) when there is one, otherwise from the file.
  Files with small row groups are read block by block; a file written as one huge row group is streamed.

Building:

1. The first search (or `POST /search/index`) starts a background build and returns at once. The response has
   `mode: "index"` and an `index` status with `state` (`missing`, `building`, `ready`, `error`), `indexed` and
   `total`. A 3 GB file takes about 70 s.
2. The frontend polls `GET /search/status` every 1.5 s, re-runs the query when the index is ready, and shows
   progress as a ring next to the dataset in the sidebar (`GET /api/search/indexing` lists all active builds).
3. Pending deletes and updates are applied to the scanned rows, and blocks holding updated rows are always
   scanned. A pending *transform* makes index results invalid; search then asks you to save or discard first.

Typical timings on a 3 GB, 1M-row file: a word that occurs nowhere takes 0.02 s, a common word takes 1.6–2.7 s
(first page plus up to 1 s of counting), and a rare combination that must be checked in every block takes about
10 s with a browse copy, or 18 s without. A plain Polars scan of the same file takes 47 s.

Indexes are stored in `settings.search.index_path/<dataset id>/v3-<size>-<mtime>/` (`blocks.bin` plus
`meta.json`). The folder name includes the file size and modification time, so an index is never used for a
changed file. Indexes from older versions are deleted when the backend starts.

Saving or restoring a dataset deletes its index, and any running build is cancelled first. The index is rebuilt
on the next search. Builds run in memory, so a backend restart interrupts them; the next search starts over.

Large files are not ranked by relevance and have no fuzzy matching; results come in file order, as for small files.

## Tuning

| Constant | Default | Meaning |
|----------|---------|---------|
| `SCAN_LIMIT_BYTES` | 256 MB | Files at or above this size use the index |
| `MIN_BLOCK_ROWS` | 10,000 | Smallest block |
| `BLOCK_BITS` | 2^20 | Fingerprint bits per block |
| `DATA_PER_FINGERPRINT` | 200 | Minimum data size per block, relative to its fingerprint |
| `COUNT_BUDGET_S` | 1.0 | Extra counting time after the page is full |
| `BUILD_WORKERS`, `SCAN_WORKERS` | 3, 6 | Threads for building and searching |

They are module constants in `search_engine.py`. The index location is configurable in `config.yaml`
(`search.index_path`).
