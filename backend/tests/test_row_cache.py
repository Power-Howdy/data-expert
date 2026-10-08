"""Window cache for browsing: same rows as a plain slice, whichever reader serves them."""
import os

import polars as pl
import pyarrow.parquet as pq
import pytest

from app.models.schemas import DataFormat
from app.services import row_cache as cache_module
from app.services.data_loader import data_loader
from app.services.row_cache import RowCache

ROWS = 5_500


@pytest.fixture()
def parquet(tmp_path):
    path = tmp_path / "rows.parquet"
    df = pl.DataFrame({
        "n": list(range(ROWS)),
        "text": [f"row {i}" for i in range(ROWS)],
        "tags": [[i % 3, i % 5] for i in range(ROWS)],
    })
    pq.write_table(df.to_arrow(), path, row_group_size=2_000)
    return str(path), df


@pytest.mark.parametrize("offset,limit", [(0, 100), (950, 100), (1_990, 30), (2_500, 1000), (5_450, 100), (5_499, 1)])
def test_rows_match_plain_slice(parquet, offset, limit):
    path, df = parquet
    rows = RowCache().rows(path, pl.scan_parquet(path), True, offset, limit, ROWS)
    assert rows.equals(df.slice(offset, limit))


def test_far_windows_use_polars_and_near_windows_stream(parquet, monkeypatch):
    path, df = parquet
    cache = RowCache()
    streamed = []
    original = cache._stream
    monkeypatch.setattr(cache, "_stream", lambda *a: streamed.append(a[3]) or original(*a))
    cache.rows(path, pl.scan_parquet(path), True, 1_500, 10, ROWS)
    assert streamed == []  # 1,500 rows into a 2,000-row group: Polars is cheaper
    cache.rows(path, pl.scan_parquet(path), True, 0, 10, ROWS)
    assert streamed == [0]
    assert cache.rows(path, pl.scan_parquet(path), True, 1_000, 10, ROWS).equals(df.slice(1_000, 10))
    assert streamed == [0, 1]  # continues from the open reader


def test_csv_and_release(tmp_path):
    path = tmp_path / "rows.csv"
    df = pl.DataFrame({"n": list(range(2_500))})
    df.write_csv(path)
    cache = RowCache()
    lf = data_loader._read_lazy(str(path), DataFormat.CSV)
    assert cache.rows(str(path), lf, False, 1_200, 50, 2_500).equals(df.slice(1_200, 50))
    cache.release(str(path))
    assert not cache._windows


def test_release_closes_readers_so_file_can_be_replaced(parquet, tmp_path):
    path, df = parquet
    cache = RowCache()
    cache.rows(path, pl.scan_parquet(path), True, 0, 10, ROWS)
    assert cache._readers
    cache.release(path)
    assert not cache._readers
    replacement = tmp_path / "new.parquet"
    df.head(10).write_parquet(replacement)
    os.replace(replacement, path)
    assert RowCache().rows(path, pl.scan_parquet(path), True, 0, 20, 10).height == 10


def test_footer_stats_without_reading_data(parquet):
    path, df = parquet
    stats = data_loader.get_stats(pl.scan_parquet(path), [None] * 3, path, DataFormat.PARQUET)
    assert stats.row_count == ROWS and stats.column_count == 3 and stats.missing_percentage == 0
    assert stats.memory_bytes > 0 and stats.duplicate_rows is None
    assert cache_module.WINDOW_ROWS == 1000
