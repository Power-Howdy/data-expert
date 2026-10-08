import os
import json
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from threading import Lock

import tantivy
from tantivy import Schema, Document, Index, parse_query, query_parser_error

from app.models.schemas import SearchRequest, SearchResult, SearchResponse, Dataset
from app.core.config import settings
from app.services.data_loader import dataset_manager

logger = logging.getLogger(__name__)


class SearchEngine:
    """Full-text search engine using Tantivy."""
    
    def __init__(self, index_base_path: str = None):
        self.index_base_path = Path(index_base_path or settings.search.index_path)
        self.index_base_path.mkdir(parents=True, exist_ok=True)
        self._indexes: Dict[str, Index] = {}
        self._schemas: Dict[str, Schema] = {}
        self._lock = Lock()
    
    def _get_index_path(self, dataset_id: str) -> Path:
        return self.index_base_path / dataset_id
    
    def _create_schema(self, columns: List[str]) -> Schema:
        """Create Tantivy schema for dataset columns."""
        schema_builder = tantivy.SchemaBuilder()
        schema_builder.add_text_field("row_id", stored=True)
        
        for col in columns:
            schema_builder.add_text_field(col, stored=True)
        
        return schema_builder.build()
    
    def _get_or_create_index(self, dataset_id: str, columns: List[str]) -> Index:
        """Get existing index or create new one."""
        with self._lock:
            if dataset_id in self._indexes:
                return self._indexes[dataset_id]
            
            index_path = self._get_index_path(dataset_id)
            index_path.mkdir(parents=True, exist_ok=True)
            
            schema = self._create_schema(columns)
            self._schemas[dataset_id] = schema
            
            try:
                index = tantivy.Index(schema, str(index_path))
            except Exception:
                index = tantivy.Index(schema, str(index_path), create=True)
            
            self._indexes[dataset_id] = index
            return index
    
    def build_index(self, dataset_id: str, batch_size: int = 10000) -> Dict[str, Any]:
        """Build search index for a dataset."""
        dataset = dataset_manager.get_dataset(dataset_id)
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        lf = dataset_manager.get_dataframe(dataset_id)
        if not lf:
            raise ValueError(f"DataFrame for {dataset_id} not found")
        
        columns = [col.name for col in dataset.columns_schema]
        index = self._get_or_create_index(dataset_id, columns)
        
        writer = index.writer(heap_size=settings.performance.max_memory_usage_mb * 1024 * 1024)
        
        try:
            total_rows = dataset.row_count
            indexed = 0
            
            for offset in range(0, total_rows, batch_size):
                batch = lf.slice(offset, batch_size).collect()
                
                for row in batch.iter_rows(named=True):
                    doc = Document()
                    doc.add_text("row_id", str(row.get("row_id", indexed)))
                    
                    for col in columns:
                        value = row.get(col)
                        if value is not None:
                            doc.add_text(col, str(value))
                    
                    writer.add_document(doc)
                    indexed += 1
                
                writer.commit()
                logger.info(f"Indexed {indexed}/{total_rows} rows for dataset {dataset_id}")
            
            index.reload()
            
            return {
                "dataset_id": dataset_id,
                "indexed_rows": indexed,
                "total_rows": total_rows,
                "columns_indexed": columns,
            }
            
        except Exception as e:
            writer.rollback()
            raise RuntimeError(f"Failed to build index: {e}")
    
    def search(self, request: SearchRequest) -> SearchResponse:
        """Perform full-text search."""
        import time
        start_time = time.time()
        
        dataset = dataset_manager.get_dataset(request.dataset_id)
        if not dataset:
            raise ValueError(f"Dataset {request.dataset_id} not found")
        
        columns = request.columns or [col.name for col in dataset.schema]
        index = self._get_or_create_index(request.dataset_id, columns)
        
        searcher = index.searcher()
        
        query_text = request.query
        if request.fuzzy:
            query_text = f"{query_text}~"
        
        try:
            # Use parse_query with the schema and field names
            query = parse_query(
                query_text,
                schema=self._schemas[request.dataset_id],
                field_names=columns,
                default_field=columns[0] if columns else "row_id"
            )
        except Exception as e:
            raise ValueError(f"Invalid query: {e}")
        
        limit = min(request.limit, settings.search.max_results)
        offset = request.offset
        
        top_docs = searcher.search(query, limit=limit + offset)
        
        results = []
        for score, doc_address in top_docs[offset:]:
            doc = searcher.doc(doc_address)
            
            row_id = doc.get_first("row_id")
            highlights = {}
            data = {}
            
            for col in columns:
                value = doc.get_first(col)
                if value:
                    data[col] = value
                    if settings.search.highlight and request.query.lower() in value.lower():
                        highlights[col] = [value]
            
            results.append(SearchResult(
                row_id=str(row_id) if row_id else "",
                score=float(score),
                highlights=highlights,
                data=data
            ))
        
        took_ms = (time.time() - start_time) * 1000
        
        return SearchResponse(
            results=results,
            total=len(top_docs),
            took_ms=took_ms
        )
    
    def suggest(self, dataset_id: str, prefix: str, limit: int = 10) -> List[str]:
        """Get search suggestions."""
        dataset = dataset_manager.get_dataset(dataset_id)
        if not dataset:
            return []
        
        columns = [col.name for col in dataset.columns_schema]
        index = self._get_or_create_index(dataset_id, columns)
        searcher = index.searcher()
        
        suggestions = set()
        
        for col in columns:
            try:
                terms = searcher.terms_dict(col)
                for term in terms:
                    if term.startswith(prefix.lower()):
                        suggestions.add(term)
                        if len(suggestions) >= limit:
                            break
            except Exception:
                continue
        
        return list(suggestions)[:limit]
    
    def delete_index(self, dataset_id: str) -> bool:
        """Delete search index for dataset."""
        with self._lock:
            if dataset_id in self._indexes:
                del self._indexes[dataset_id]
            if dataset_id in self._schemas:
                del self._schemas[dataset_id]
            
            index_path = self._get_index_path(dataset_id)
            if index_path.exists():
                import shutil
                shutil.rmtree(index_path)
                return True
        return False
    
    def get_index_stats(self, dataset_id: str) -> Dict[str, Any]:
        """Get index statistics."""
        index_path = self._get_index_path(dataset_id)
        if not index_path.exists():
            return {"exists": False}
        
        try:
            columns = []
            dataset = dataset_manager.get_dataset(dataset_id)
            if dataset:
                columns = [col.name for col in dataset.columns_schema]
            
            index = self._get_or_create_index(dataset_id, columns)
            searcher = index.searcher()
            
            return {
                "exists": True,
                "path": str(index_path),
                "num_docs": searcher.num_docs(),
                "columns": columns,
            }
        except Exception as e:
            return {"exists": True, "error": str(e)}


search_engine = SearchEngine()