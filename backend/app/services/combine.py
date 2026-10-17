import polars as pl
from pathlib import Path
from typing import Optional, List, Dict, Any, Union
import uuid
import logging

from app.models.schemas import (
    Dataset, DataFormat, CombineRequest, SeparateRequest,
    ColumnSchema, DatasetStats
)
from app.services.data_loader import dataset_manager, data_loader
from app.core.config import settings

logger = logging.getLogger(__name__)


class CombineEngine:
    """Handle dataset combination and separation operations."""
    
    def combine(self, request: CombineRequest) -> Dataset:
        """Combine multiple datasets."""
        if len(request.dataset_ids) < 2:
            raise ValueError("At least 2 datasets required for combine")
        
        dataframes = []
        schemas = []
        
        for ds_id in request.dataset_ids:
            lf = dataset_manager.get_dataframe(ds_id)
            if lf is None:
                raise ValueError(f"Dataset {ds_id} not found")
            df = lf.collect()
            dataframes.append(df)
            dataset = dataset_manager.get_dataset(ds_id)
            schemas.append(dataset.columns_schema if dataset else [])
        
        if request.strategy == "concat":
            combined = self._concat_dataframes(dataframes, schemas)
        elif request.strategy == "join":
            combined = self._join_dataframes(dataframes, request.join_config)
        elif request.strategy == "merge":
            combined = self._merge_dataframes(dataframes, request.join_config)
        else:
            raise ValueError(f"Unknown combine strategy: {request.strategy}")
        
        # Save combined dataset
        output_path = self._get_output_path(request.output_name, request.output_format)
        data_loader.write(combined, output_path, request.output_format)
        
        # Create new dataset entry
        new_lf = data_loader.load_lazy(output_path, request.output_format)
        schema = data_loader.get_schema(new_lf)
        stats = data_loader.get_stats(new_lf, schema, output_path, request.output_format)
        
        dataset = Dataset(
            name=request.output_name,
            path=output_path,
            format=request.output_format,
            schema=schema,
            stats=stats,
            row_count=stats.row_count,
            size_bytes=Path(output_path).stat().st_size,
        )
        
        dataset_manager.register(dataset, new_lf)
        
        return dataset
    
    def _concat_dataframes(
        self, 
        dataframes: List[pl.DataFrame], 
        schemas: List[List[ColumnSchema]]
    ) -> pl.DataFrame:
        """Concatenate dataframes vertically."""
        # Align schemas
        all_columns = set()
        for schema in schemas:
            all_columns.update(col.name for col in schema)
        
        aligned_dfs = []
        for df in dataframes:
            missing = all_columns - set(df.columns)
            for col in missing:
                df = df.with_columns(pl.lit(None).alias(col))
            # Reorder columns
            df = df.select(sorted(all_columns))
            aligned_dfs.append(df)
        
        return pl.concat(aligned_dfs, how="vertical_relaxed")
    
    def _join_dataframes(
        self, 
        dataframes: List[pl.DataFrame], 
        join_config: Optional[Dict[str, Any]]
    ) -> pl.DataFrame:
        """Join dataframes on common keys."""
        if not join_config:
            raise ValueError("Join config required for join strategy")
        
        left_on = join_config.get("left_on")
        right_on = join_config.get("right_on", left_on)
        how = join_config.get("how", "inner")
        
        if len(dataframes) != 2:
            raise ValueError("Join strategy currently supports only 2 datasets")
        
        left, right = dataframes
        return left.join(right, left_on=left_on, right_on=right_on, how=how)
    
    def _merge_dataframes(
        self, 
        dataframes: List[pl.DataFrame], 
        join_config: Optional[Dict[str, Any]]
    ) -> pl.DataFrame:
        """Merge dataframes (outer join with coalesce)."""
        if not join_config:
            raise ValueError("Merge config required for merge strategy")
        
        on = join_config.get("on")
        if not on:
            raise ValueError("Merge requires 'on' column")
        
        result = dataframes[0]
        for df in dataframes[1:]:
            result = result.join(df, on=on, how="outer", coalesce=True)
        
        return result
    
    def separate(self, request: SeparateRequest) -> List[Dataset]:
        """Separate a dataset by unique values in a column."""
        lf = dataset_manager.get_dataframe(request.dataset_id)
        if lf is None:
            raise ValueError(f"Dataset {request.dataset_id} not found")
        
        dataset = dataset_manager.get_dataset(request.dataset_id)
        if not dataset:
            raise ValueError(f"Dataset {request.dataset_id} not found")
        
        df = lf.collect()
        
        if request.column not in df.columns:
            raise ValueError(f"Column {request.column} not found in dataset")
        
        # Get unique values
        unique_values = df[request.column].unique().to_list()
        
        output_dir = Path(request.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        created_datasets = []
        
        for value in unique_values:
            if value is None:
                subset = df.filter(pl.col(request.column).is_null())
                value_str = "null"
            else:
                subset = df.filter(pl.col(request.column) == value)
                value_str = str(value).replace("/", "_").replace("\\", "_")
            
            if subset.height == 0:
                continue
            
            output_name = f"{dataset.name}_{request.column}_{value_str}"
            output_path = output_dir / f"{output_name}.{request.output_format.value}"
            
            data_loader.write(subset, str(output_path), request.output_format)
            
            new_lf = data_loader.load_lazy(str(output_path), request.output_format)
            schema = data_loader.get_schema(new_lf)
            stats = data_loader.get_stats(new_lf, schema, str(output_path), request.output_format)
            
            new_dataset = Dataset(
                name=output_name,
                path=str(output_path),
                format=request.output_format,
                schema=schema,
                stats=stats,
                row_count=stats.row_count,
                size_bytes=Path(output_path).stat().st_size,
            )
            
            dataset_manager.register(new_dataset, new_lf)
            created_datasets.append(new_dataset)
        
        return created_datasets
    
    def _get_output_path(self, name: str, format: DataFormat) -> str:
        """Generate output path for combined dataset."""
        output_dir = Path("./data_expert_outputs")
        output_dir.mkdir(parents=True, exist_ok=True)
        
        ext_map = {
            DataFormat.PARQUET: "parquet",
            DataFormat.CSV: "csv",
            DataFormat.JSON: "json",
            DataFormat.JSONL: "jsonl",
            DataFormat.FEATHER: "feather",
        }
        ext = ext_map.get(format, "parquet")
        return str(output_dir / f"{name}.{ext}")
    
    def preview_combine(
        self, 
        dataset_ids: List[str], 
        strategy: str = "concat",
        join_config: Optional[Dict[str, Any]] = None,
        limit: int = 10
    ) -> pl.DataFrame:
        """Preview combine operation without saving."""
        dataframes = []
        for ds_id in dataset_ids:
            lf = dataset_manager.get_dataframe(ds_id)
            if lf is None:
                raise ValueError(f"Dataset {ds_id} not found")
            dataframes.append(lf.collect())
        
        if strategy == "concat":
            combined = self._concat_dataframes(dataframes, [])
        elif strategy == "join":
            combined = self._join_dataframes(dataframes, join_config)
        elif strategy == "merge":
            combined = self._merge_dataframes(dataframes, join_config)
        else:
            raise ValueError(f"Unknown strategy: {strategy}")
        
        return combined.head(limit)


combine_engine = CombineEngine()