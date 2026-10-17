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

- The rows are split into blocks of at least 10,000 rows (`MIN_BLOCK_ROWS`), aligned with browse-copy batches.
- For each block the index keeps a 256-Kbit (32 KB) fingerprint: a Bloom-style bit set of every 2- and 3-byte
  snippet in the block's lowercased text.
- It also keeps a word list (`words.parquet`): every distinct word (`\w+`, lowercased) with the blocks it occurs
  in. A query word can only occur inside a word of the text, so a block qualifies only if some word in it
  contains each word of the query. Words that occur nowhere are answered from the index alone, in milliseconds.
- The whole index stays under 1/100 of the file (`INDEX_RATIO`); a word list that would not fit is left out and
  the fingerprints are used alone. For a 3 GB, 1M-row file it is 25 MB (3 MB of fingerprints, 21 MB word list),
  down from 14.8 GB with the previous Tantivy index.
- The remaining blocks are scanned in parallel (16 threads) in file order:
  - Each term is matched column by column. Columns whose type cannot spell the term are skipped; for example,
    numbers and lists of numbers only contain digits, signs, exponents and words like `null` or `nan`.
  - Only the columns that can match are decoded. The other columns are read just for the returned rows.
  - Longer terms are matched first, and later terms only check the rows that are still left.
- Once a page of results is full, counting stops 1.2 s after the search started (`COUNT_BUDGET_S`). If it stops
  early, `total_exact` is `false` and `total` is a lower bound (the UI shows “1,234+”).
- Where the blocks are read from:
  - The [browse copy](user-guide.md#browsing-rows), when there is one. It is the fastest source: an Arrow file
    whose 10,000-row batches decode in one decompression pass, several times faster than Parquet.
  - A Parquet file with small row groups, read block by block.
  - Otherwise (a Parquet file written as one huge row group, or a large CSV), the file is streamed once.

Building:

1. The first search (or `POST /search/index`) starts a background build and returns at once. The response has
   `mode: "index"` and an `index` status with `state` (`missing`, `building`, `ready`, `error`), `indexed` and
   `total`. A 3 GB file takes about 8 minutes.
2. The frontend polls `GET /search/status` every 1.5 s, re-runs the query when the index is ready, and shows
   progress as a ring next to the dataset in the sidebar (`GET /api/search/indexing` lists all active builds).
3. Pending deletes and updates are applied to the scanned rows, and blocks holding updated rows are always
   scanned. A pending *transform* makes index results invalid; search then asks you to save or discard first.

Typical timings on a 3 GB, 1M-row file with a browse copy (8-core desktop):

| Query | Time |
|-------|------|
| A word that occurs nowhere (`zzqqxj`) | 0.04 s |
| Words in a few blocks only (`deadend`, `deadend job`) | 0.2–0.7 s |
| Common words that fill a page (`the`, `photosynthesis`, `kubernetes`) | 1.3–1.5 s |
| Rare combinations of common words, checked in every block (`mitochondria membrane potential`) | 1.8–1.9 s |

Without a browse copy, a file written as one huge row group is streamed, and the worst case takes 10–20 s. A
plain Polars scan of the same file takes 47 s.

Indexes are stored in `settings.search.index_path/<dataset id>/v5-<size>-<mtime>/` (`blocks.bin`, `words.parquet`
and `meta.json`). The folder name includes the file size and modification time, so an index is never used for a
changed file. Indexes from older versions are deleted when the backend starts.

Saving or restoring a dataset deletes its index, and any running build is cancelled first. The index is rebuilt
on the next search. Builds run in memory, so a backend restart interrupts them; the next search starts over.

Large files are not ranked by relevance and have no fuzzy matching; results come in file order, as for small files.

## Tuning

| Constant | Default | Meaning |
|----------|---------|---------|
| `SCAN_LIMIT_BYTES` | 256 MB | Files at or above this size use the index |
| `MIN_BLOCK_ROWS` | 10,000 | Smallest block |
| `BLOCK_BITS` | 2^18 | Fingerprint bits per block |
| `DATA_PER_FINGERPRINT` | 800 | Minimum data size per block, relative to its fingerprint |
| `INDEX_RATIO` | 100 | The index stays under 1/`INDEX_RATIO` of the file |
| `WORD_PATTERN` | `\w+` | How text is split into words for the word list |
| `COUNT_BUDGET_S` | 1.2 | Once the page is full, stop counting this long after the search started |
| `BUILD_WORKERS`, `SCAN_WORKERS` | 3, 16 | Threads for building and searching |

They are module constants in `search_engine.py`. The index location is configurable in `config.yaml`
(`search.index_path`).
