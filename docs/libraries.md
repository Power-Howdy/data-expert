# Libraries

Data Expert is built on open-source libraries. This page lists the notable ones, what each does in the app, and
where to learn more. Exact versions are pinned in [`backend/requirements.txt`](../backend/requirements.txt) and
[`frontend/package.json`](../frontend/package.json) (resolved in `package-lock.json`).

## Backend (Python 3.14)

| Library | Version | Used for | License |
|---------|---------|----------|---------|
| [FastAPI](https://fastapi.tiangolo.com/) | 0.142 | REST API: routes, request validation, OpenAPI docs at `/docs` | MIT |
| [Starlette](https://www.starlette.io/) | 1.7 | ASGI toolkit under FastAPI; streamed downloads | BSD-3-Clause |
| [Uvicorn](https://www.uvicorn.org/) | 0.54 | ASGI server that runs the backend (`python -m app.main`) | BSD-3-Clause |
| [sse-starlette](https://github.com/sysid/sse-starlette) | 3.5 | Server-sent events for streamed AI responses | BSD-3-Clause |
| [Pydantic](https://docs.pydantic.dev/) v2 | 2.14 | Request and response models, AI plan validation | MIT |
| [pydantic-settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/) | 2.15 | Settings from `config.yaml` and environment variables | MIT |
| [PyYAML](https://pyyaml.org/) | 6.0 | Reads `config.yaml` | MIT |
| [Polars](https://pola.rs/) | 2.0 | The data engine: lazy reading of every format, paging, search scans, edits, transforms, statistics, export | MIT |
| [PyArrow](https://arrow.apache.org/docs/python/) | 25 | Parquet metadata (instant file open), streaming row readers, Arrow IPC browse copies, ORC | Apache-2.0 |
| [NumPy](https://numpy.org/) | 2.5 | Search index fingerprints and vectorized statistics | BSD-3-Clause |
| [HTTPX](https://www.python-httpx.org/) | 0.28 | Calls to OpenAI-compatible, Anthropic and Gemini model APIs | BSD-3-Clause |
| [fastexcel](https://github.com/ToucanToco/fastexcel) | 0.21 | Reading Excel files (`.xlsx`, `.xls`) through Polars | MIT |
| [XlsxWriter](https://xlsxwriter.readthedocs.io/) | 3.2 | Exporting to Excel through Polars | BSD-2-Clause |
| [fastavro](https://fastavro.readthedocs.io/) | 1.13 | Reading Avro files | MIT |

## Frontend (React + TypeScript)

| Library | Version | Used for | License |
|---------|---------|----------|---------|
| [React](https://react.dev/) | 18 | UI components | MIT |
| [TypeScript](https://www.typescriptlang.org/) | 5 | Static types for the whole frontend | Apache-2.0 |
| [Vite](https://vite.dev/) | 8 | Dev server and production build | MIT |
| [Tailwind CSS](https://tailwindcss.com/) | 3 | Styling | MIT |
| [Radix UI](https://www.radix-ui.com/primitives) | 1–2 | Accessible primitives behind `src/components/ui/` (select, tabs, dropdown, checkbox, scroll area) | MIT |
| [TanStack Table](https://tanstack.com/table) | 8 | The Browse data table: columns, sizing, row selection | MIT |
| [TanStack Query](https://tanstack.com/query) | 5 | Server-state caching and request deduplication | MIT |
| [zustand](https://zustand.docs.pmnd.rs/) | 4 | Global state stores (`src/stores/`) | MIT |
| [axios](https://axios-http.com/) | 1 | HTTP client behind every `src/lib/*Api.ts` module | MIT |
| [Recharts](https://recharts.org/) | 2.12 | Charts in Stats and column details | MIT |
| [CodeMirror 6](https://codemirror.net/) via [@uiw/react-codemirror](https://uiwjs.github.io/react-codemirror/) | 6 / 4.25 | JSON row editor and code views | MIT |
| [lucide-react](https://lucide.dev/) | 0.303 | Icons | ISC |
| [react-hot-toast](https://react-hot-toast.com/) | 2 | Notifications | MIT |
| [clsx](https://github.com/lukeed/clsx) + [tailwind-merge](https://github.com/dcastil/tailwind-merge) | 2 / 3 | Combining class names (`cn()` helper) | MIT |

## Development and testing

| Library | Used for | License |
|---------|----------|---------|
| [pytest](https://pytest.org/) and [pytest-asyncio](https://pytest-asyncio.readthedocs.io/) | Backend test suite (`cd backend && pytest`) | MIT / Apache-2.0 |
| [mypy](https://mypy-lang.org/) | Optional static type checks for the backend | MIT |
| [ESLint](https://eslint.org/) 9 with [typescript-eslint](https://typescript-eslint.io/), react-hooks and react-refresh plugins | Frontend linting (`npm run lint`) | MIT |
| [PostCSS](https://postcss.org/) and [Autoprefixer](https://github.com/postcss/autoprefixer) | Tailwind build pipeline | MIT |

## AI model servers

Data Expert does not bundle a model. It talks to any OpenAI-compatible server (for example
[llama.cpp](https://github.com/ggml-org/llama.cpp), [Ollama](https://ollama.com/), [LM Studio](https://lmstudio.ai/)
or [vLLM](https://docs.vllm.ai/)) and to hosted providers. See [AI assistant](ai-assistant.md).
