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
from app.services.profile_store import dataset_fingerprint, profile_store

logger = logging.getLogger(__name__)

DEFAULT_PROFILE_SAMPLE = 100_000
MAX_TOP_VALUE_CHARS = 200


def numeric_values(series: pl.Series) -> pl.Series:
    """Non-null, non-NaN values of a numeric series."""
    values = series.drop_nulls()
    if values.dtype.is_float():
        values = values.filter(values.is_not_nan())
    return values


def histogram(values: pl.Series, bins: int) -> Dict[str, List[float]]:
    """Histogram as counts plus bin edges (len(counts) + 1)."""
    if values.len() == 0:
        return {"bins": [], "bin_edges": []}
    hist = values.hist(bin_count=bins)
    edges = [float(values.min())] + [float(b) for b in hist["breakpoint"].to_list()]
    return {"bins": hist["count"].to_list(), "bin_edges": edges}


def numeric_summary(values: pl.Series) -> Dict[str, float]:
    return {
        "min": float(values.min()),
        "max": float(values.max()),
        "mean": float(values.mean()),
        "std": float(values.std()) if values.len() > 1 else 0.0,
        "median": float(values.median()),
    }


def display_value(value: Any) -> Any:
    if isinstance(value, str) and len(value) > MAX_TOP_VALUE_CHARS:
        return value[:MAX_TOP_VALUE_CHARS] + "…"
    return value


class AnalyticsEngine:
    """Compute analytics and statistics for datasets."""
    
    def __init__(self):
        self._cache: Dict[str, Tuple[str, DatasetProfile]] = {}
    
    def get_overview(self, dataset_id: str) -> AnalyticsOverview:
        """Get high-level dataset overview."""
        dataset = dataset_manager.get_dataset(dataset_id)
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        lf = dataset_manager.get_dataframe(dataset_id)
        if lf is None:
            raise ValueError(f"DataFrame for {dataset_id} not found")
        
        stats = dataset.stats
        if stats is None:
            stats = dataset_manager.loader.get_stats(lf, dataset.columns_schema)
            dataset.stats = stats
        
        column_types: Dict[str, int] = {}
        for col in dataset.columns_schema:
            column_types[col.type.value] = column_types.get(col.type.value, 0) + 1
        
        return AnalyticsOverview(
            dataset_id=dataset_id,
            row_count=stats.row_count,
            column_count=stats.column_count,
            memory_bytes=stats.memory_bytes,
            missing_percentage=stats.missing_percentage,
            duplicate_rows=stats.duplicate_rows,
            column_types=column_types
        )
    
    def get_saved_profile(self, dataset_id: str) -> Optional[DatasetProfile]:
        """Return the stored profile if it still matches the dataset's current data."""
        dataset = dataset_manager.get_dataset(dataset_id)
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} not found")
        fingerprint = dataset_fingerprint(dataset)
        cached = self._cache.get(dataset_id)
        if cached and cached[0] == fingerprint:
            return cached[1]
        profile = profile_store.load(dataset)
        if profile:
            self._cache[dataset_id] = (fingerprint, profile)
        return profile
    
    def forget_profile(self, dataset_id: str) -> None:
        self._cache.pop(dataset_id, None)
        profile_store.delete(dataset_id)
    
    def profile_dataset(
        self, dataset_id: str, sample_size: Optional[int] = None, refresh: bool = False
    ) -> DatasetProfile:
        """Return the saved profile, or generate (and save) one; large datasets are sampled."""
        if not refresh:
            saved = self.get_saved_profile(dataset_id)
            if saved:
                return saved
        sample_size = sample_size or DEFAULT_PROFILE_SAMPLE
        
        dataset = dataset_manager.get_dataset(dataset_id)
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        lf = dataset_manager.get_dataframe(dataset_id)
        if lf is None:
            raise ValueError(f"DataFrame for {dataset_id} not found")
        
        if dataset.row_count > sample_size:
            step = -(-dataset.row_count // sample_size)
            df = lf.gather_every(step).collect()
        else:
            df = lf.collect()
        
        columns = []
        for col_schema in dataset.columns_schema:
            col_name = col_schema.name
            col_profile = self._profile_column(df, col_name, col_schema.type)
            columns.append(col_profile)
        
        correlations = self._compute_correlations(df, dataset.columns_schema)
        missing_matrix = self._compute_missing_matrix(df, dataset.columns_schema)
        
        profile = DatasetProfile(
            dataset_id=dataset_id,
            row_count=df.height,
            column_count=df.width,
            memory_bytes=df.estimated_size(),
            columns=columns,
            correlations=correlations,
            missing_matrix=missing_matrix,
            sampled=dataset.row_count > sample_size,
        )
        
        self._cache[dataset_id] = (dataset_fingerprint(dataset), profile)
        profile_store.save(dataset, profile)
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
        
        values = numeric_values(series) if col_type in (DataType.INTEGER, DataType.FLOAT) else None
        if values is not None and values.len() > 0:
            summary = numeric_summary(values)
            profile.min = summary["min"]
            profile.max = summary["max"]
            profile.mean = summary["mean"]
            profile.std = summary["std"]
            profile.median = summary["median"]
            profile.quantiles = {
                f"q{i + 1}": float(values.quantile(q, interpolation="nearest"))
                for i, q in enumerate((0.25, 0.5, 0.75))
            }
            profile.histogram = histogram(values, 20)
        
        elif col_type == DataType.STRING and non_null.len() > 0:
            value_counts = non_null.value_counts().sort("count", descending=True).head(20)
            profile.top_values = [
                {"value": display_value(row[col_name]), "count": row["count"]}
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
                    value = corr_matrix[i, j]
                    if value is not None and np.isfinite(value):
                        result[col1][col2] = float(value)
            
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
        if lf is None:
            raise ValueError(f"DataFrame for {dataset_id} not found")
        
        col_schema = next((c for c in dataset.columns_schema if c.name == column), None)
        if not col_schema:
            raise ValueError(f"Column {column} not found")
        
        if col_schema.type in (DataType.INTEGER, DataType.FLOAT):
            values = numeric_values(lf.select(pl.col(column)).collect()[column])
            return {
                "type": "histogram",
                **histogram(values, bins),
                "stats": numeric_summary(values) if values.len() > 0 else {},
            }

        dtype = lf.collect_schema()[column]
        values, note = lf.select(pl.col(column)), ""
        if isinstance(dtype, (pl.List, pl.Array)):
            values, note = values.select(pl.col(column).explode()), "Most common items across all lists"
            dtype = dtype.inner
        values = values.drop_nulls()
        if dtype.is_numeric():
            return self._item_histogram(values, column, bins)
        if isinstance(dtype, (pl.Struct, pl.List, pl.Array)):
            # Wrap in a one-field struct to JSON-encode any nesting, then strip the `{"v":` wrapper.
            encoded = pl.struct(pl.col(column).alias("v")).struct.json_encode().str.slice(5).str.head(-1)
            values, note = values.select(encoded.alias(column)), note or "Values shown as JSON"
        elif dtype == pl.Binary or dtype == pl.Null:
            return {"type": "bar", "values": [], "counts": [], "total_unique": 0, "note": "This column type cannot be charted"}

        counts = values.group_by(column).len().sort("len", descending=True).head(50).collect()
        total_unique = values.select(pl.col(column).n_unique()).collect().item()
        return {
            "type": "bar",
            "values": [display_value(v if isinstance(v, (str, int, float, bool)) else str(v)) for v in counts[column].to_list()],
            "counts": counts["len"].to_list(),
            "total_unique": total_unique,
            "note": note,
        }
    
    @staticmethod
    def _item_histogram(values: pl.LazyFrame, column: str, bins: int) -> Dict[str, Any]:
        """Histogram of every number inside a list column, computed by Polars without materializing the items."""
        col = pl.col(column).cast(pl.Float64)
        col = col.filter(col.is_not_nan())
        row = values.select(
            col.min().alias("min"), col.max().alias("max"), col.mean().alias("mean"),
            col.std().alias("std"), col.median().alias("median"), col.len().alias("n"),
        ).collect().row(0, named=True)
        if not row["n"]:
            return {"type": "histogram", "bins": [], "bin_edges": [], "stats": {}}
        hist = values.select(col.hist(bin_count=bins, include_breakpoint=True)).collect().to_series().struct.unnest()
        stats = {k: float(row[k] or 0.0) for k in ("min", "max", "mean", "std", "median")}
        return {
            "type": "histogram",
            "bins": hist["count"].to_list(),
            "bin_edges": [stats["min"]] + [float(b) for b in hist["breakpoint"].to_list()],
            "stats": stats,
            "note": "Distribution of all numbers across the lists",
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
        if lf is None:
            raise ValueError(f"DataFrame for {dataset_id} not found")
        
        series = numeric_values(lf.select(pl.col(column)).collect()[column])
        if not series.dtype.is_numeric() or series.len() == 0:
            return {"outliers": [], "count": 0, "method": method, "threshold": threshold, "bounds": None}
        
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
            "outliers": outliers.head(1000).to_list(),
            "count": outliers.len(),
            "method": method,
            "threshold": threshold,
            "bounds": {"lower": float(lower), "upper": float(upper)} if method == "iqr" else None
        }


analytics_engine = AnalyticsEngine()