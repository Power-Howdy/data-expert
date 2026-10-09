# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Open-source project files: license, contributing guide, code of conduct, security policy, issue and pull
  request templates, and CI.
- Documentation under `docs/`.
- Sidebar badges: loaded datasets show icons for whether they are indexed for searching and optimized for
  browsing (`GET /api/datasets/features`).
- **Optimize for browsing**: for large files whose deep pages load slowly (Parquet written as huge row groups,
  or big CSV/JSON files), the Browse tab offers to build a copy in small batches in the background. With it,
  any page of a 3 GB, 1M-row file loads in under 0.15 s (down from 1–2 s). The copy is rebuilt after saving and
  deleted when the dataset is unloaded or you click Remove.

### Fixed

- `.gitignore` no longer excludes `package.json`, `package-lock.json` and `tsconfig*.json`.
- Column details showed an empty distribution for list, array and struct columns. List items are now counted
  (number lists get a histogram of their items), struct values are shown as JSON, and the counts are computed
  lazily.

### Changed

- The search index for large files is now under 1/100 of the file instead of several times its size: 25 MB
  instead of 14.8 GB for a 3 GB, 1M-row Parquet file. It stores per-block n-gram fingerprints and a word list,
  and scans only the blocks that can match, so results are exactly those of a full scan (substring,
  case-insensitive). Large-file results are no longer ranked or fuzzy-matched, the `search/suggest` endpoint was
  removed, and responses include `total_exact`. Tantivy is no longer a dependency; old indexes are deleted at
  startup.
- Faster large-file search: with a browse copy, every search of a 3 GB, 1M-row file takes under 2 s (0.04 s with
  no match, 1.3–1.5 s for common words, 1.8–1.9 s for rare combinations checked in every block), versus 47 s for a
  full scan. Blocks are scanned in parallel, only the columns that can contain a term are decoded, and counting
  stops 1.2 s after the search started once the page is full.
- Browse copies are now Arrow IPC files (zstd, 10,000-row batches) instead of Parquet: about the same size, with
  batches that decode several times faster. Existing Parquet copies are deleted at startup; click **Optimize for
  browsing** again to rebuild them.
- Much faster opening and browsing of large files. Opening a file reads only metadata: 0.07 s, down from
  14.8 s, for a 3 GB, 1M-row Parquet file. Row pages come from a window cache with a streaming Parquet reader, so
  first pages, next pages and opening a row take under 0.1 s, down from 2–4 s. Saving a version no longer rescans
  the file. Missing % and duplicate counts are skipped for large non-Parquet files.
- The Search button on the Browse tab shows and hides the search box, like the AI and Filters buttons.
- Search results show how long the search took, next to the match count.
- The Stats tab uses varied charts instead of bar charts everywhere: donuts for column types, completeness,
  duplicates and columns with few values; area curves, box plots and cumulative share for numbers; a quality
  scatter plot of all columns; a scatter of outliers against their fences; and a diverging bar chart of the
  strongest correlations. It is organized in Overview, Column Profiles, Correlations, Missing Values and AI
  Insights tabs. The distribution endpoint's top-values response now includes `total` (non-empty values).
- Indexing and browse-copy status is no longer polled while nothing is building; during a build only that
  dataset's status is polled.

## [1.0.0]

First public release.

### Added

- **Data loading:** lazy reading of Parquet, CSV, TSV, JSON, JSON Lines, JSON.gz, Feather, Avro, ORC and Excel;
  folder tree; persistent dataset registry.
- **Browsing:** paged table, filters, row drawer with nested values.
- **Search:** direct scan with pending edits for files under 256 MB; background Tantivy index with live progress
  for larger files; fuzzy fallback.
- **Editing:** add, update, delete, find & replace (exact, contains, regex), with undo and discard. Edits are
  applied lazily, and saves are atomic.
- **Version history:** git-like commits on every save, with reverse deltas for row edits and hardlinked
  snapshots for transforms. View, compare (schema and rows), restore, tag, save as, external-change detection,
  storage settings.
- **AI assistant:** plain-language transforms planned from a function library. The model can generate new
  functions, which are sandboxed. Plans run locally in background jobs, results open as previewable views, and
  views can be applied or saved as new files. 22 provider presets, local and cloud. Configurable prompts and
  model settings.
- **AI insights:** written summaries of dataset profiles.
- **Analytics:** overview, column profiles, distributions, outliers, correlations and a missing-value matrix.
- **Export:** multiple formats, column selection, compression, Parquet partitioning, streamed download.
- **Combine:** concatenate, join and merge datasets; separate a dataset by column values.
- **UI:** collapsible data folder section, footer with backend status, in-app user guide, light and dark themes.
