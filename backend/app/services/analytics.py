import polars as pl
import numpy as np
from typing import Optional, List, Dict, Any, Tuple
from collections import Counter
import logging

from app.models.schemas import (
    DatasetProfile, ColumnProfile, AnalyticsOverview, 
    DataType, Dataset
)
from app.services.data_loader import dataset_manager

logger = logging.getLogger(__name__)


class AnalyticsEngine:
    """Compute analytics and statistics for datasets."""
    
    def __init__(self):
        self._cache: Dict[str, DatasetProfile] = {}
    
    def get_overview(self, dataset_id: str) -> AnalyticsOverview:
        """Get high-level dataset overview."""
        dataset = dataset_manager.get_dataset(dataset_id)
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        lf = dataset_manager.get_dataframe(dataset_id)
        if not lf:
            raise ValueError(f"DataFrame for {dataset_id} not found")
        
        df = lf.collect()
        
        column_types = {}
        for col in dataset.schema:
            column_types[col.type.value] = column_types.get(col.type.value, 0) + 1
        
        return AnalyticsOverview(
            dataset_id=dataset_id,
            row_count=dataset.row_count,
            column_count=dataset.column_count,
            memory_bytes=df.estimated_size(),
            missing_percentage=dataset.stats.missing_percentage if dataset.stats else 0,
            duplicate_rows=df.n_unique() - df.height if df.height > 0 else 0,
            column_types=column_types
        )
    
    def profile_dataset(self, dataset_id: str, sample_size: Optional[int] = None) -> DatasetProfile:
        """Generate full dataset profile."""
        cache_key = f"{dataset_id}:{sample_size}"
        if cache_key in self._cache:
            return self._cache[cache_key]
        
        dataset = dataset_manager.get_dataset(dataset_id)
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        lf = dataset_manager.get_dataframe(dataset_id)
        if not lf:
            raise ValueError(f"DataFrame for {dataset_id} not found")
        
        if sample_size and dataset.row_count > sample_size:
            df = lf.sample(n=sample_size, seed=42).collect()
        else:
            df = lf.collect()
        
        columns = []
        for col_schema in dataset.schema:
            col_name = col_schema.name
            col_profile = self._profile_column(df, col_name, col_schema.type)
            columns.append(col_profile)
        
        correlations = self._compute_correlations(df, dataset.schema)
        missing_matrix = self._compute_missing_matrix(df, dataset.schema)
        
        profile = DatasetProfile(
            dataset_id=dataset_id,
            row_count=df.height,
            column_count=df.width,
            memory_bytes=df.estimated_size(),
            columns=columns,
            correlations=correlations,
            missing_matrix=missing_matrix
        )
        
        self._cache[cache_key] = profile
        return profile
    
    def _profile_column(self, df: pl.DataFrame, col_name: str, col_type: DataType) -> ColumnProfile:
        """Profile a single column."""
        series = df[col_name]
        count = series.len()
        null_count = series.null_count()
        null_percentage = (null_count / count * 100) if count > 0 else 0
        
        non_null = series.drop_nulls()
        unique_count = non_null.n_unique()
        unique_percentage = (unique_count / count * 100) if count > 0 else 0
        
        profile = ColumnProfile(
            name=col_name,
            type=col_type,
            count=count,
            null_count=null_count,
            null_percentage=null_percentage,
            unique_count=unique_count,
            unique_percentage=unique_percentage,
        )
        
        if col_type in (DataType.INTEGER, DataType.FLOAT) and non_null.len() > 0:
            profile.min = float(non_null.min())
            profile.max = float(non_null.max())
            profile.mean = float(non_null.mean())
            profile.std = float(non_null.std()) if non_null.len() > 1 else 0
            profile.median = float(non_null.median())
            
            quantiles = non_null.quantile([0.25, 0.5, 0.75], interpolation="nearest")
            profile.quantiles = {
                "q1": float(quantiles[0]),
                "q2": float(quantiles[1]),
                "q3": float(quantiles[2]),
            }
            
            hist = non_null.hist(bins=20)
            profile.histogram = {
                "bins": hist[0].to_list(),
                "bin_edges": hist[1].to_list(),
            }
        
        elif col_type == DataType.STRING and non_null.len() > 0:
            value_counts = non_null.value_counts().sort("count", descending=True).head(20)
            profile.top_values = [
                {"value": row[col_name], "count": row["count"]}
                for row in value_counts.iter_rows(named=True)
            ]
        
        elif col_type == DataType.BOOLEAN and non_null.len() > 0:
            value_counts = non_null.value_counts()
            profile.top_values = [
                {"value": row[col_name], "count": row["count"]}
                for row in value_counts.iter_rows(named=True)
            ]
        
        return profile
    
    def _compute_correlations(
        self, 
        df: pl.DataFrame, 
        schema: List
    ) -> Optional[Dict[str, Dict[str, float]]]:
        """Compute correlation matrix for numeric columns."""
        numeric_cols = [
            col.name for col in schema 
            if col.type in (DataType.INTEGER, DataType.FLOAT)
        ]
        
        if len(numeric_cols) < 2:
            return None
        
        try:
            numeric_df = df.select(numeric_cols)
            corr_matrix = numeric_df.corr()
            
            result = {}
            for i, col1 in enumerate(numeric_cols):
                result[col1] = {}
                for j, col2 in enumerate(numeric_cols):
                    result[col1][col2] = float(corr_matrix[i, j])
            
            return result
        except Exception as e:
            logger.warning(f"Failed to compute correlations: {e}")
            return None
    
    def _compute_missing_matrix(
        self, 
        df: pl.DataFrame, 
        schema: List
    ) -> Optional[Dict[str, Dict[str, int]]]:
        """Compute missing value co-occurrence matrix."""
        try:
            null_cols = df.null_count()
            if null_cols.sum_horizontal().item() == 0:
                return None
            
            cols = [col.name for col in schema]
            result = {}
            
            for col1 in cols:
                result[col1] = {}
                for col2 in cols:
                    if col1 == col2:
                        result[col1][col2] = int(null_cols[col1].item())
                    else:
                        both_null = df.filter(
                            pl.col(col1).is_null() & pl.col(col2).is_null()
                        ).height
                        result[col1][col2] = both_null
            
            return result
        except Exception as e:
            logger.warning(f"Failed to compute missing matrix: {e}")
            return None
    
    def get_column_distribution(
        self, 
        dataset_id: str, 
        column: str, 
        bins: int = 50
    ) -> Dict[str, Any]:
        """Get detailed distribution for a column."""
        dataset = dataset_manager.get_dataset(dataset_id)
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        lf = dataset_manager.get_dataframe(dataset_id)
        if not lf:
            raise ValueError(f"DataFrame for {dataset_id} not found")
        
        col_schema = next((c for c in dataset.schema if c.name == column), None)
        if not col_schema:
            raise ValueError(f"Column {column} not found")
        
        series = lf.select(pl.col(column)).collect()[column]
        non_null = series.drop_nulls()
        
        if col_schema.type in (DataType.INTEGER, DataType.FLOAT):
            hist = non_null.hist(bins=bins)
            return {
                "type": "histogram",
                "bins": hist[0].to_list(),
                "bin_edges": hist[1].to_list(),
                "stats": {
                    "min": float(non_null.min()),
                    "max": float(non_null.max()),
                    "mean": float(non_null.mean()),
                    "std": float(non_null.std()) if non_null.len() > 1 else 0,
                    "median": float(non_null.median()),
                }
            }
        else:
            value_counts = non_null.value_counts().sort("count", descending=True)
            return {
                "type": "bar",
                "values": value_counts[column].to_list(),
                "counts": value_counts["count"].to_list(),
                "total_unique": non_null.n_unique(),
            }
    
    def detect_outliers(
        self, 
        dataset_id: str, 
        column: str, 
        method: str = "iqr",
        threshold: float = 1.5
    ) -> Dict[str, Any]:
        """Detect outliers in a numeric column."""
        dataset = dataset_manager.get_dataset(dataset_id)
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        lf = dataset_manager.get_dataframe(dataset_id)
        if not lf:
            raise ValueError(f"DataFrame for {dataset_id} not found")
        
        series = lf.select(pl.col(column)).collect()[column].drop_nulls()
        
        if method == "iqr":
            q1 = series.quantile(0.25, interpolation="nearest")
            q3 = series.quantile(0.75, interpolation="nearest")
            iqr = q3 - q1
            lower = q1 - threshold * iqr
            upper = q3 + threshold * iqr
            outliers = series.filter((series < lower) | (series > upper))
        
        elif method == "zscore":
            mean = series.mean()
            std = series.std()
            if std == 0:
                return {"outliers": [], "count": 0, "method": method}
            z_scores = (series - mean).abs() / std
            outliers = series.filter(z_scores > threshold)
        
        else:
            raise ValueError(f"Unknown method: {method}")
        
        return {
            "outliers": outliers.to_list(),
            "count": outliers.len(),
            "method": method,
            "threshold": threshold,
            "bounds": {"lower": float(lower), "upper": float(upper)} if method == "iqr" else None
        }


analytics_engine = AnalyticsEngine()