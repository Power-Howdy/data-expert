# Data Expert System - Technical Specification

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React + TS)                    │
│  ┌──────────┐  ┌────────────────────────────────────────────┐  │
│  │ Sidebar  │  │           Main Content Area                │  │
│  │ - Dir    │  │  ┌──────┐ ┌─────────┐ ┌───────┐ ┌────────┐ │
│  │   Picker │  │  │Browse│ │Analytics│ │Export │ │Combine │ │
│  │ - Dataset│  │  │ Tab  │ │  Tab    │ │ Tab   │ │  Tab   │ │
│  │   Tree   │  │  └──────┘ └─────────┘ └───────┘ └────────┘ │
│  └──────────┘  └────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    HTTP/WS/SSE
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Backend (FastAPI)                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │ Data Loader  │ │  Search      │ │  Analytics   │             │
│  │  (Polars)    │ │  (Tantivy)   │ │  Engine      │             │
│  └──────────────┘ └──────────────┘ └──────────────┘             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │ Manipulation │ │  Combine/    │ │  Export      │             │
│  │  Engine      │ │  Separate    │ │  Engine      │             │
│  └──────────────┘ └──────────────┘ └──────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                    File System (User Directories)
```

## Backend Specification

### Tech Stack
- **Framework**: FastAPI (async, streaming support)
- **Data Processing**: Polars (fast, streaming), PyArrow (Parquet)
- **Search**: Tantivy (Rust-based, fast full-text search)
- **Streaming**: Server-Sent Events (SSE) for real-time data streaming
- **Compression**: gzip, zstd support

### API Endpoints

#### Directory & Dataset Management
```
GET    /api/directories/tree              # Get directory tree
POST   /api/directories/scan              # Scan directory for data files
GET    /api/datasets                      # List all loaded datasets
GET    /api/datasets/{id}                 # Get dataset metadata
POST   /api/datasets/load                 # Load dataset from path
DELETE /api/datasets/{id}                 # Unload dataset
```

#### Data Browsing (Streaming)
```
GET    /api/datasets/{id}/stream          # SSE stream for lazy loading
GET    /api/datasets/{id}/rows            # Paginated rows (offset/limit)
GET    /api/datasets/{id}/schema          # Get schema info
POST   /api/datasets/{id}/filter          # Filter rows
POST   /api/datasets/{id}/sort            # Sort rows
```

#### Search
```
POST   /api/datasets/{id}/search          # Full-text search
POST   /api/datasets/{id}/search/semantic # Semantic/vector search (future)
GET    /api/datasets/{id}/search/suggest  # Search suggestions
```

#### Analytics
```
GET    /api/datasets/{id}/stats           # Basic statistics
GET    /api/datasets/{id}/profile         # Full data profile
GET    /api/datasets/{id}/correlations    # Correlation matrix
GET    /api/datasets/{id}/distributions   # Column distributions
GET    /api/datasets/{id}/missing         # Missing value analysis
```

#### Data Manipulation
```
POST   /api/datasets/{id}/rows            # Add row(s)
PUT    /api/datasets/{id}/rows/{row_id}   # Update row
DELETE /api/datasets/{id}/rows/{row_id}   # Delete row
POST   /api/datasets/{id}/replace         # Replace values
POST   /api/datasets/{id}/transform       # Apply transformation
```

#### Combine/Separate
```
POST   /api/datasets/combine              # Combine multiple datasets
POST   /api/datasets/separate             # Separate dataset by column
POST   /api/datasets/join                 # Join datasets
```

#### Export
```
POST   /api/datasets/{id}/export          # Export to various formats
GET    /api/datasets/{id}/export/stream   # Stream export
```

### Data Format Support
| Format | Reader | Writer | Streaming |
|--------|--------|--------|-----------|
| Parquet | ✓ | ✓ | ✓ |
| JSON | ✓ | ✓ | ✓ |
| JSONL | ✓ | ✓ | ✓ |
| JSON.gz | ✓ | ✓ | ✓ |
| CSV | ✓ | ✓ | ✓ |
| TSV | ✓ | ✓ | ✓ |
| Feather | ✓ | ✓ | ✓ |
| Avro | ✓ | ✓ | ✓ |
| ORC | ✓ | ✓ | - |
| Excel | ✓ | ✓ | - |

## Frontend Specification

### Tech Stack
- **Framework**: React 18 + TypeScript
- **Build**: Vite
- **UI Library**: shadcn/ui (Radix UI primitives) + Tailwind CSS
- **State**: TanStack Query (React Query) + Zustand
- **Tables**: TanStack Table v8 (virtualized, sortable, filterable)
- **Charts**: Recharts / Apache ECharts
- **Icons**: Lucide React

### Components

#### Layout
- **AppShell**: Main layout with sidebar + content
- **Sidebar**: Collapsible, directory picker, dataset tree
- **Header**: Global search, notifications, settings

#### Sidebar Components
- **DirectoryPicker**: Native folder picker (File System Access API) or path input
- **DatasetTree**: Recursive tree view of loaded datasets with lazy loading
- **DatasetNode**: Individual dataset with context menu

#### Dataset Tabs
1. **BrowseTab**: 
   - Virtualized data grid (TanStack Table)
   - Column sorting, filtering, pinning
   - Real-time streaming indicator
   - Row selection, context menu
   - Infinite scroll / pagination

2. **AnalyticsTab**:
   - Overview cards (rows, cols, memory, missing %)
   - Column profiles (type, unique, null, min/max/mean/std)
   - Distribution histograms
   - Correlation heatmap
   - Missing value matrix
   - Outlier detection

3. **ExportTab**:
   - Format selector (multi-format)
   - Column selection
   - Compression options
   - Partition/Chunk options
   - Download/stream export

4. **CombineTab**:
   - Dataset selector (multi-select)
   - Combine strategy (concat, join, merge)
   - Column mapping
   - Preview result
   - Save as new dataset

### Advanced Features (Brainstormed)
1. **Data Profiling**: Automatic schema inference, type detection, quality metrics
2. **Data Lineage**: Track transformations, show DAG of operations
3. **Query Builder**: Visual SQL-like query builder
4. **Data Diff**: Compare two datasets
5. **Anonymization**: PII detection and masking
6. **Schema Registry**: Save/load schemas
7. **Bookmarks**: Save filter/sort/search states
8. **Collaboration**: Share dataset views via URL
9. **Plugin System**: Custom transformers, exporters
10. **Keyboard Shortcuts**: Power user navigation

## Data Models

### Dataset
```typescript
interface Dataset {
  id: string;
  name: string;
  path: string;
  format: DataFormat;
  schema: ColumnSchema[];
  stats: DatasetStats;
  rowCount: number;
  sizeBytes: number;
  loadedAt: Date;
  lastModified: Date;
}
```

### ColumnSchema
```typescript
interface ColumnSchema {
  name: string;
  type: DataType;
  nullable: boolean;
  uniqueCount: number;
  nullCount: number;
  stats?: ColumnStats;
}
```

### DataFormat
```typescript
type DataFormat = 'parquet' | 'json' | 'jsonl' | 'json.gz' | 'csv' | 'tsv' | 'feather' | 'avro' | 'orc' | 'xlsx';
```

## Implementation Phases

### Phase 1: Core Backend (Week 1)
- FastAPI setup with async endpoints
- Polars-based data loader with format detection
- SSE streaming for large datasets
- Basic search with Tantivy

### Phase 2: Backend Features (Week 1-2)
- Analytics engine (stats, profiles, correlations)
- Data manipulation APIs
- Combine/separate/join operations
- Export engine

### Phase 3: Frontend Core (Week 2)
- React + Vite + TypeScript setup
- shadcn/ui + Tailwind
- Sidebar with directory picker
- Dataset tree view

### Phase 4: Frontend Tabs (Week 2-3)
- Browse tab with virtualized table
- Analytics tab with charts
- Export tab
- Combine tab

### Phase 5: Polish & Advanced (Week 3)
- Real-time streaming UI
- Keyboard shortcuts
- Data profiling
- Error handling, loading states
- Testing

## Configuration

### Backend Config (config.yaml)
```yaml
server:
  host: "0.0.0.0"
  port: 8000
  cors_origins: ["http://localhost:5173"]

data:
  max_stream_chunk: 10000
  default_page_size: 100
  max_preview_rows: 1000
  search_index_path: "./.data_expert/search_indexes"

formats:
  auto_detect: true
  encoding: "utf-8"
  csv_delimiter: ","

performance:
  polars_threads: 0  # auto
  stream_buffer_size: 65536
```

## Security Considerations
- Path traversal protection (validate paths stay within allowed roots)
- File size limits for uploads
- Rate limiting on search/analytics endpoints
- No authentication (local tool), but validate all inputs

## Future Extensibility
- Plugin architecture for custom formats
- WebAssembly for client-side processing
- DuckDB integration for SQL queries
- Vector search with embeddings
- Real-time collaboration via WebRTC