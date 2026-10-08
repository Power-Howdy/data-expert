import polars as pl
from pathlib import Path
from typing import Optional, List, Dict, Any, Union
import uuid
import logging

from app.models.schemas import (
    Dataset, DataFormat, ColumnSchema, RowData, RowsResponse,
    AddRowRequest, UpdateRowRequest, ReplaceRequest, TransformRequest,
    FilterParams, SortParams, DataType
)
from app.services.data_loader import dataset_manager, data_loader
from app.core.config import settings

logger = logging.getLogger(__name__)


class DataManipulationEngine:
    """Handle data manipulation operations: CRUD, replace, transform."""
    
    def __init__(self):
        self._pending_changes: Dict[str, List[Dict]] = {}
    
    def get_rows(
        self, 
        dataset_id: str, 
        offset: int = 0, 
        limit: int = 100,
        filters: Optional[List[FilterParams]] = None,
        sorts: Optional[List[SortParams]] = None
    ) -> RowsResponse:
        """Get paginated rows with optional filtering and sorting."""
        lf = dataset_manager.get_dataframe(dataset_id)
        if not lf:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        dataset = dataset_manager.get_dataset(dataset_id)
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        # Apply pending changes if any
        lf = self._apply_pending_changes(dataset_id, lf)
        
        # Apply filters
        if filters:
            for f in filters:
                lf = self._apply_filter(lf, f.column, f.operator, f.value)
        
        # Apply sorts
        if sorts:
            sort_exprs = []
            for s in sorts:
                sort_exprs.append(pl.col(s.column).sort(descending=not s.ascending))
            lf = lf.sort(sort_exprs)
        
        total = lf.select(pl.len()).collect().item()
        rows_df = lf.slice(offset, limit).collect()
        
        rows = []
        for i, row in enumerate(rows_df.iter_rows(named=True)):
            row_id = row.get("row_id", str(uuid.uuid4()))
            rows.append(RowData(id=row_id, data=row))
        
        return RowsResponse(
            rows=rows,
            total=total,
            offset=offset,
            limit=limit
        )
    
    def _apply_filter(self, lf: pl.LazyFrame, column: str, operator: str, value: Any) -> pl.LazyFrame:
        col_expr = pl.col(column)
        
        ops = {
            "eq": col_expr == value,
            "ne": col_expr != value,
            "gt": col_expr > value,
            "gte": col_expr >= value,
            "lt": col_expr < value,
            "lte": col_expr <= value,
            "contains": col_expr.str.contains(str(value)),
            "startswith": col_expr.str.starts_with(str(value)),
            "endswith": col_expr.str.ends_with(str(value)),
            "in": col_expr.is_in(value) if isinstance(value, list) else col_expr == value,
            "not_in": ~col_expr.is_in(value) if isinstance(value, list) else col_expr != value,
            "is_null": col_expr.is_null(),
            "is_not_null": col_expr.is_not_null(),
        }
        
        if operator in ops:
            return lf.filter(ops[operator])
        
        raise ValueError(f"Unknown operator: {operator}")
    
    def add_row(self, dataset_id: str, request: AddRowRequest) -> RowData:
        """Add a new row to the dataset."""
        lf = dataset_manager.get_dataframe(dataset_id)
        if not lf:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        dataset = dataset_manager.get_dataset(dataset_id)
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        # Validate row data against schema
        validated_data = self._validate_row_data(request.data, dataset.columns_schema)
        validated_data["row_id"] = str(uuid.uuid4())
        
        # Add to pending changes
        if dataset_id not in self._pending_changes:
            self._pending_changes[dataset_id] = []
        self._pending_changes[dataset_id].append({
            "type": "add",
            "data": validated_data
        })
        
        return RowData(id=validated_data["row_id"], data=validated_data)
    
    def update_row(self, dataset_id: str, row_id: str, request: UpdateRowRequest) -> RowData:
        """Update an existing row."""
        lf = dataset_manager.get_dataframe(dataset_id)
        if not lf:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        dataset = dataset_manager.get_dataset(dataset_id)
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        # Validate row data
        validated_data = self._validate_row_data(request.data, dataset.columns_schema)
        validated_data["row_id"] = row_id
        
        # Add to pending changes
        if dataset_id not in self._pending_changes:
            self._pending_changes[dataset_id] = []
        self._pending_changes[dataset_id].append({
            "type": "update",
            "row_id": row_id,
            "data": validated_data
        })
        
        return RowData(id=row_id, data=validated_data)
    
    def delete_row(self, dataset_id: str, row_id: str) -> bool:
        """Delete a row."""
        if dataset_id not in self._pending_changes:
            self._pending_changes[dataset_id] = []
        self._pending_changes[dataset_id].append({
            "type": "delete",
            "row_id": row_id
        })
        return True
    
    def replace_values(self, dataset_id: str, request: ReplaceRequest) -> int:
        """Replace values in a column."""
        if dataset_id not in self._pending_changes:
            self._pending_changes[dataset_id] = []
        self._pending_changes[dataset_id].append({
            "type": "replace",
            "column": request.column,
            "old_value": request.old_value,
            "new_value": request.new_value,
            "case_sensitive": request.case_sensitive
        })
        return 1  # Return count of affected rows (would be computed on commit)
    
    def transform(self, dataset_id: str, request: TransformRequest) -> Dict[str, Any]:
        """Apply transformation operations."""
        if dataset_id not in self._pending_changes:
            self._pending_changes[dataset_id] = []
        self._pending_changes[dataset_id].append({
            "type": "transform",
            "operations": request.operations
        })
        return {"success": True, "operations": len(request.operations)}
    
    def _validate_row_data(self, data: Dict[str, Any], schema: List[ColumnSchema]) -> Dict[str, Any]:
        """Validate and coerce row data to match schema."""
        validated = {}
        for col in schema:
            value = data.get(col.name)
            if value is None:
                if not col.nullable:
                    raise ValueError(f"Column {col.name} is not nullable")
                validated[col.name] = None
            else:
                validated[col.name] = self._coerce_value(value, col.type)
        return validated
    
    def _coerce_value(self, value: Any, target_type: DataType) -> Any:
        """Coerce value to target type."""
        try:
            if target_type == DataType.INTEGER:
                return int(value)
            elif target_type == DataType.FLOAT:
                return float(value)
            elif target_type == DataType.BOOLEAN:
                if isinstance(value, str):
                    return value.lower() in ("true", "1", "yes", "y")
                return bool(value)
            elif target_type == DataType.STRING:
                return str(value)
            elif target_type in (DataType.DATETIME, DataType.DATE, DataType.TIME):
                return str(value)  # Keep as string for now
            return value
        except Exception:
            raise ValueError(f"Cannot coerce {value} to {target_type}")
    
    def _apply_pending_changes(self, dataset_id: str, lf: pl.LazyFrame) -> pl.LazyFrame:
        """Apply pending changes to LazyFrame."""
        changes = self._pending_changes.get(dataset_id, [])
        if not changes:
            return lf
        
        # Collect to apply changes
        df = lf.collect()
        
        for change in changes:
            if change["type"] == "add":
                new_row = pl.DataFrame([change["data"]])
                df = pl.concat([df, new_row], how="vertical_relaxed")
            
            elif change["type"] == "update":
                row_id = change["row_id"]
                data = change["data"]
                # Update row where row_id matches
                mask = df["row_id"] == row_id
                for col, val in data.items():
                    if col != "row_id":
                        df = df.with_columns(
                            pl.when(mask).then(pl.lit(val)).otherwise(pl.col(col)).alias(col)
                        )
            
            elif change["type"] == "delete":
                row_id = change["row_id"]
                df = df.filter(pl.col("row_id") != row_id)
            
            elif change["type"] == "replace":
                col = change["column"]
                old_val = change["old_value"]
                new_val = change["new_value"]
                case_sensitive = change.get("case_sensitive", True)
                if case_sensitive:
                    df = df.with_columns(
                        pl.when(pl.col(col) == old_val).then(new_val).otherwise(pl.col(col)).alias(col)
                    )
                else:
                    df = df.with_columns(
                        pl.when(pl.col(col).str.to_lowercase() == str(old_val).lower())
                        .then(new_val).otherwise(pl.col(col)).alias(col)
                    )
            
            elif change["type"] == "transform":
                for op in change["operations"]:
                    df = self._apply_transform_op(df, op)
        
        return df.lazy()
    
    def _apply_transform_op(self, df: pl.DataFrame, op: Dict[str, Any]) -> pl.DataFrame:
        """Apply a single transformation operation."""
        op_type = op.get("type")
        
        if op_type == "rename":
            return df.rename({op["old_name"]: op["new_name"]})
        
        elif op_type == "drop":
            return df.drop(op["columns"])
        
        elif op_type == "cast":
            return df.with_columns(
                pl.col(op["column"]).cast(getattr(pl, op["target_type"]))
            )
        
        elif op_type == "fill_null":
            return df.with_columns(
                pl.col(op["column"]).fill_null(op["value"])
            )
        
        elif op_type == "derive":
            expr_str = op["expression"]
            return df.with_columns(
                pl.col(op["expression"]).alias(op["new_column"])
            )
        
        return df
    
    def commit_changes(self, dataset_id: str) -> Dict[str, Any]:
        """Commit pending changes to disk."""
        lf = dataset_manager.get_dataframe(dataset_id)
        if not lf:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        dataset = dataset_manager.get_dataset(dataset_id)
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        # Apply changes
        df = self._apply_pending_changes(dataset_id, lf)
        
        # Write back to file
        data_loader.write(df, dataset.path, dataset.format)
        
        # Reload dataset
        new_lf = data_loader.load_lazy(dataset.path, dataset.format)
        schema = data_loader.get_schema(new_lf)
        stats = data_loader.get_stats(new_lf, schema)
        
        dataset.columns_schema = schema
        dataset.stats = stats
        dataset.row_count = stats.row_count
        dataset.size_bytes = Path(dataset.path).stat().st_size
        
        dataset_manager.dataframes[dataset_id] = new_lf
        
        # Clear pending changes
        self._pending_changes[dataset_id] = []
        
        return {"success": True, "rows_affected": df.height}
    
    def discard_changes(self, dataset_id: str) -> None:
        """Discard pending changes."""
        if dataset_id in self._pending_changes:
            self._pending_changes[dataset_id] = []
    
    def get_pending_changes(self, dataset_id: str) -> List[Dict]:
        """Get pending changes for a dataset."""
        return self._pending_changes.get(dataset_id, [])


manipulation_engine = DataManipulationEngine()