# Data Expert

[![CI](https://github.com/power-howdy/data-expert/actions/workflows/ci.yml/badge.svg)](https://github.com/power-howdy/data-expert/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**A local-first workbench for exploring, editing, versioning and transforming datasets, from kilobytes to many
gigabytes.** Point it at a folder, open any Parquet, CSV, JSON or Excel file, and browse, search, profile, edit and
reshape it in your browser. Every save becomes a version you can compare and restore, and an AI assistant turns
plain-language requests into transformations, without ever sending your data to the model.

## Highlights

- **Huge files, fast.** Polars reads lazily: opening a multi-gigabyte Parquet file reads its metadata, and each
  page reads only the rows it shows.
- **Search everything.** Search every column, including nested values. Small files are scanned live, with your
  unsaved edits; large files get a compact background index (about 1/200 of the file) that narrows each search to the
  parts of the file that can match.
- **Safe editing.** Edit rows as a form or JSON, add and delete rows, and find & replace (exact, contains, regex).
  Changes stay pending, with undo, until you save; saves are atomic.
- **Git-like version history for data.** Every save is a commit. Row edits are stored as reverse deltas of a few
  kilobytes, whatever the file size. View, diff (schema and rows), restore, tag, or export any version.
- **AI assistant, privacy first.** Describe a change ("keep 2024 rows, add a word count column"). The model plans
  steps from a function library, writes new sandboxed functions if needed, and the plan runs locally. Only the
  schema, statistics and a few truncated samples reach the model. Works with Ollama, LM Studio, llama.cpp, vLLM,
  OpenAI, Anthropic, Gemini, OpenRouter and 14 more.
- **Profiling and insights.** Column statistics, distributions, outliers, correlations, a missing-value matrix, and
  AI-written summaries.
- **Export and combine.** Export to any supported format, with compression, Parquet partitioning and streamed
  downloads. Concatenate, join and merge datasets, or split one by a column.

Supported formats: Parquet, CSV, TSV, JSON, JSON Lines, JSON.gz, Feather, Avro, ORC, Excel.

## Quick start

Requirements: **Python 3.14+** (with tkinter) and **Node.js 24+**.

```bash
# Backend: http://localhost:8000 (API docs at /docs)
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m app.main

# Frontend: http://127.0.0.1:5173 (in a second terminal)
cd frontend
npm install
npm run dev
```

Or run `./start.sh` (macOS/Linux) or `start.bat` (Windows) to set up and start both.

Then click **Choose folder** in the sidebar, pick a folder with data files, and click a file to open it. The
**?** button opens the in-app user guide.

Full instructions: [docs/getting-started.md](docs/getting-started.md).

## Documentation

| | |
|---|---|
| [Getting started](docs/getting-started.md) | Install, run, first steps |
| [User guide](docs/user-guide.md) | Every feature, step by step |
| [AI assistant](docs/ai-assistant.md) | Providers, plans, function library, sandbox, privacy |
| [Version history](docs/version-control.md) | How data versioning works and is stored |
| [Search](docs/search.md) | Scan vs. index, semantics, tuning |
| [Configuration](docs/configuration.md) | `config.yaml`, environment variables, state locations |
| [Architecture](docs/architecture.md) | Components and data flow |
| [API reference](docs/api-reference.md) | REST endpoints |
| [Development](docs/development.md) | Setup, tests, conventions |
| [Troubleshooting](docs/troubleshooting.md) | Common problems |

## Tech stack

| Backend | Frontend |
|---------|----------|
| FastAPI, Pydantic v2 | React 18, TypeScript, Vite |
| Polars, PyArrow | Tailwind CSS, Radix UI |
| NumPy (search index) | zustand, TanStack Query/Table |
| httpx (OpenAI-compatible LLM APIs) | Recharts, CodeMirror 6 |

## Project structure

```
data-expert/
├── backend/
│   ├── app/
│   │   ├── main.py            FastAPI app and core routes
│   │   ├── api/               AI and version-history routers
│   │   ├── core/config.py     settings (config.yaml)
│   │   ├── models/            Pydantic schemas
│   │   └── services/          data loading, editing, versioning, search, analytics, AI, functions, export
│   ├── tests/                 pytest suite
│   ├── config.yaml
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/        one folder per feature + common/ and ui/ building blocks
│       ├── hooks/  lib/  stores/  types/
│       └── App.tsx
├── docs/                      documentation
└── docker-compose.yml
```

## Privacy and security

Data Expert runs on your machine and does not upload data. AI providers receive only column names, types, summary
statistics and a few truncated sample values; with a local model server, nothing leaves your machine.

The backend API has **no authentication** and full file-system access for the user running it. It is meant for
local, single-user use. Bind it to `127.0.0.1` and do not expose it to untrusted networks; see
[SECURITY.md](SECURITY.md).

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md). Notable changes are listed in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
