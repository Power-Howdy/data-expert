# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Open-source project files: license, contributing guide, code of conduct, security policy, issue and pull
  request templates, and CI.
- Documentation under `docs/`.

### Fixed

- `.gitignore` no longer excludes `package.json`, `package-lock.json` and `tsconfig*.json`.

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
