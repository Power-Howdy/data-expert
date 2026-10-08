# Configuration

## Backend: `backend/config.yaml`

The backend reads `config.yaml` from its working directory at startup. Always start it from `backend/`.

```yaml
server:
  host: "0.0.0.0"          # use "127.0.0.1" to accept local connections only (recommended)
  port: 8000
  cors_origins:            # origins allowed to call the API from a browser
    - "http://localhost:5173"
    - "http://127.0.0.1:5173"

data:
  max_stream_chunk: 10000
  default_page_size: 100
  max_preview_rows: 1000
  search_index_path: "./.data_expert/search_indexes"
  allowed_extensions: [".parquet", ".json", ".jsonl", ".json.gz", ".csv", ".tsv",
                       ".feather", ".avro", ".orc", ".xlsx", ".xls"]

formats:
  auto_detect: true
  encoding: "utf8"
  csv_delimiter: ","
  json_lines: true

performance:
  polars_threads: 0        # 0 = Polars default (all cores)
  stream_buffer_size: 65536
  max_memory_usage_mb: 2048

search:
  engine: "tantivy"
  index_path: "./.data_expert/search_indexes"
  max_results: 1000        # upper bound for a search page
  highlight: true

export:
  max_rows_per_file: 1000000
  compression: "gzip"
  partition_size_mb: 100
```

`data.registry_path` (default `./.data_expert/datasets.json`) sets where the dataset registry lives. AI settings,
generated functions, profiles and insights are stored in the same folder.

### Security-relevant settings

The API has no authentication and can read and write any file the backend process can access. Keep
`server.host` at `127.0.0.1` unless the machine is on a trusted network, and keep `cors_origins` limited to the
frontend's origin. See [SECURITY.md](../SECURITY.md).

### Environment variables

Settings are Pydantic settings. Environment variables (or a `backend/.env` file) override defaults for values that
`config.yaml` does not set, using `__` for nesting, for example `SERVER__PORT=9000`.

AI provider keys can come from the environment instead of the settings UI:

| Provider | Variable |
|----------|----------|
| OpenAI | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| Google Gemini | `GEMINI_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` |
| Mistral | `MISTRAL_API_KEY` |
| Groq | `GROQ_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| xAI | `XAI_API_KEY` |
| Together | `TOGETHER_API_KEY` |
| Fireworks | `FIREWORKS_API_KEY` |
| Cerebras | `CEREBRAS_API_KEY` |
| Perplexity | `PERPLEXITY_API_KEY` |
| Cohere | `COHERE_API_KEY` |
| NVIDIA NIM | `NVIDIA_API_KEY` |
| Hugging Face | `HF_TOKEN` |

A key saved in the settings UI takes precedence over the environment variable.

## Frontend

| File | Setting |
|------|---------|
| `frontend/.env.development` | `VITE_API_URL=http://127.0.0.1:8000/api`: the browser calls the API directly. Vite 5's dev proxy can stall on large responses under Node 24 |
| `frontend/vite.config.ts` | Dev server port (5173) and a `/api` proxy to `127.0.0.1:8000`, used when `VITE_API_URL` is unset |

If `VITE_API_URL` is unset, the frontend calls `/api` on its own origin. If you change the backend port or host,
update `VITE_API_URL` and add the frontend origin to `cors_origins`.

User preferences are stored in the browser's local storage: the selected dataset and folder, the sidebar's state
and width, the fold state of the Data folder section, and the theme.

## Where state is stored

| Path | Contents | Safe to delete? |
|------|----------|-----------------|
| `backend/.data_expert/datasets.json` | Loaded datasets | Yes; datasets must be loaded again |
| `backend/.data_expert/ai_settings.json` | Providers, **API keys**, prompts | Yes; resets AI settings |
| `backend/.data_expert/functions.json` | Generated functions | Yes; saved transforms embed what they need |
| `backend/.data_expert/profiles/`, `insights/` | Cached profiles and insights | Yes; regenerated on demand |
| `backend/.data_expert/search_indexes/` | Search indexes | Yes; rebuilt on the next search |
| `backend/.data_expert/browse_copies/` | Browse copies (“Optimize for browsing”), about the size of each file | Yes, with the backend stopped; deep pages get slow again until you rebuild |
| `backend/data_expert_exports/`, `data_expert_outputs/` | Default export and combine output | Your files |
| `<data folder>/.data-expert-history/` | Version history | Deleting it loses history; the data files stay |

## Version history settings

Per file, in the History tab's settings: `keep_snapshots` (default 5, range 0–100), the number of full snapshots
kept for transform commits. See [Version history](version-control.md#storage-and-pruning).
