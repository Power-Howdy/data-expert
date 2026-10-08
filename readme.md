# Data Expert System

A modern, powerful data exploration and analysis tool with a Streamlit-like backend and React frontend.

## Features

### Backend (FastAPI + Polars)
- **Multi-format support**: Parquet, JSON, JSONL, JSON.gz, CSV, TSV, Feather, Avro, ORC, Excel
- **Streaming data loading**: Lazy evaluation with Polars for memory efficiency
- **Real-time streaming**: Server-Sent Events (SSE) for large dataset browsing
- **Full-text search**: Tantivy-powered search engine with highlighting
- **Power BI-like analytics**: Statistics, profiling, correlations, distributions, outlier detection
- **Data manipulation**: Add, update, delete rows; replace values; transform data
- **Dataset operations**: Combine (concat, join, merge), separate by column
- **Multi-format export**: Export to any supported format with compression and partitioning

### Frontend (React + TypeScript + shadcn/ui)
- **Modern UI**: Clean, responsive design with dark mode support
- **Sidebar**: Directory browser with recursive tree view
- **Dataset tabs**:
  - **Browse**: Virtualized table with sorting, filtering, search, pagination
  - **Analytics**: Overview stats, column profiles, correlation heatmap, missing value matrix
  - **Export**: Multi-format export with column selection, compression, partitioning
  - **Combine**: Visual dataset combination with preview
- **Real-time updates**: React Query for caching and synchronization

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- pnpm (recommended) or npm

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m app.main
```

The API will be available at `http://localhost:8000`
API docs at `http://localhost:8000/docs`

### Frontend Setup

```bash
cd frontend
pnpm install  # or npm install
pnpm dev
```

The frontend will be available at `http://localhost:5173`

### Using Docker

```bash
docker-compose up --build
```

## Project Structure

```
data-expert/
├── backend/
│   ├── app/
│   │   ├── api/           # API routes
│   │   ├── core/          # Configuration
│   │   ├── models/        # Pydantic schemas
│   │   ├── services/      # Business logic
│   │   │   ├── data_loader.py      # Multi-format data loading
│   │   │   ├── search_engine.py    # Tantivy search
│   │   │   ├── analytics.py        # Statistics & profiling
│   │   │   ├── manipulation.py     # CRUD operations
│   │   │   ├── combine.py          # Combine/separate datasets
│   │   │   ├── export.py           # Multi-format export
│   │   │   └── directory_scanner.py # Directory scanning
│   │   └── main.py        # FastAPI app
│   ├── config.yaml        # Configuration
│   └── requirements.txt   # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── ui/        # shadcn/ui components
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── BrowseTab.tsx
│   │   │   ├── AnalyticsTab.tsx
│   │   │   ├── ExportTab.tsx
│   │   │   └── CombineTab.tsx
│   │   ├── hooks/         # Custom hooks
│   │   ├── lib/           # Utilities & API client
│   │   ├── stores/        # Zustand state management
│   │   ├── types/         # TypeScript types
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
└── SPEC.md                # Technical specification
```

## API Endpoints

### Directory & Dataset Management
- `GET /api/directories/tree` - Get directory tree
- `POST /api/directories/scan` - Scan directory for data files
- `GET /api/datasets` - List loaded datasets
- `POST /api/datasets/load` - Load dataset from path
- `DELETE /api/datasets/{id}` - Unload dataset

### Data Browsing
- `GET /api/datasets/{id}/rows` - Paginated rows with filters/sorts
- `GET /api/datasets/{id}/stream` - SSE stream for real-time browsing
- `GET /api/datasets/{id}/schema` - Get dataset schema

### Search
- `POST /api/datasets/{id}/search` - Full-text search
- `GET /api/datasets/{id}/search/suggest` - Search suggestions
- `POST /api/datasets/{id}/search/index` - Build search index

### Analytics
- `GET /api/datasets/{id}/stats` - Overview statistics
- `GET /api/datasets/{id}/profile` - Full data profile
- `GET /api/datasets/{id}/distributions/{column}` - Column distribution
- `GET /api/datasets/{id}/outliers/{column}` - Outlier detection

### Data Manipulation
- `POST /api/datasets/{id}/rows` - Add row
- `PUT /api/datasets/{id}/rows/{row_id}` - Update row
- `DELETE /api/datasets/{id}/rows/{row_id}` - Delete row
- `POST /api/datasets/{id}/replace` - Replace values
- `POST /api/datasets/{id}/transform` - Apply transformations
- `POST /api/datasets/{id}/commit` - Commit changes to disk
- `POST /api/datasets/{id}/discard` - Discard pending changes

### Combine/Separate
- `POST /api/datasets/combine` - Combine datasets
- `POST /api/datasets/separate` - Separate dataset by column
- `POST /api/datasets/combine/preview` - Preview combine operation

### Export
- `POST /api/datasets/{id}/export` - Export to file
- `GET /api/datasets/{id}/export/stream` - Stream export
- `GET /api/export/formats` - Get supported formats

## Configuration

Edit `backend/config.yaml` to customize:
- Server host/port/CORS
- Data loading limits
- Search index path
- Performance settings
- Export options

## Supported Formats

| Format | Read | Write | Stream | Partition |
|--------|------|-------|--------|-----------|
| Parquet | ✓ | ✓ | ✓ | ✓ |
| CSV/TSV | ✓ | ✓ | ✓ | - |
| JSON/JSONL | ✓ | ✓ | ✓ | - |
| JSON.gz | ✓ | ✓ | ✓ | - |
| Feather | ✓ | ✓ | ✓ | - |
| Avro | ✓ | ✓ | - | - |
| ORC | ✓ | ✓ | - | - |
| Excel | ✓ | ✓ | - | - |

## Advanced Features

### Data Profiling
Automatic schema inference, type detection, quality metrics (completeness, uniqueness, validity)

### Search Engine
- Full-text search with Tantivy
- Fuzzy matching
- Highlighting
- Column-specific search
- Search suggestions

### Streaming
- Server-Sent Events for real-time row streaming
- Chunked loading for large datasets
- Progressive rendering in UI

### Data Lineage (Planned)
- Track transformations
- Visual DAG of operations
- Reproducible pipelines

## Development

### Running Tests
```bash
# Backend
cd backend && pytest

# Frontend
cd frontend && pnpm test
```

### Linting
```bash
# Backend
cd backend && ruff check .

# Frontend
cd frontend && pnpm lint
```

## License

MIT