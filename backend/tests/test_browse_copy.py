"""Browse copies: built on request with small row groups, used for paging, replaced when the file changes."""
import time

import polars as pl
import pyarrow.parquet as pq
import pytest

from app.models.schemas import LoadDatasetRequest
from app.services import browse_copy as module
from app.services.browse_copy import browse_copies
from app.services.data_loader import dataset_manager
from app.services.manipulation import manipulation_engine as engine
from app.services.row_cache import row_cache

ROWS = 5_500
DF = pl.DataFrame({
    "n": list(range(ROWS)),
    "text": [f"row {i}" for i in range(ROWS)],
    "tags": [[i % 3, i % 5] for i in range(ROWS)],
})


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    monkeypatch.setattr(dataset_manager, "registry_path", tmp_path / "datasets.json")
    monkeypatch.setattr(dataset_manager, "datasets", {})
    monkeypatch.setattr(dataset_manager, "dataframes", {})
    monkeypatch.setattr(dataset_manager, "options", {})
    monkeypatch.setattr(browse_copies, "base", tmp_path / "copies")
    monkeypatch.setattr(module, "BROWSE_GROUP_ROWS", 1_000)


def load(tmp_path, name="rows.parquet"):
    path = tmp_path / name
    if name.endswith(".csv"):
        DF.drop("tags").write_csv(path)
    else:
        pq.write_table(DF.to_arrow(), path, row_group_size=ROWS)
    ds = dataset_manager.load_dataset(LoadDatasetRequest(path=str(path)))
    engine.discard_changes(ds.id)
    return ds


def wait_ready(dataset_id):
    for _ in range(200):
        status = browse_copies.status(dataset_id)
        if status.state != "building":
            return status
        time.sleep(0.05)
    raise TimeoutError("browse copy did not finish")


def test_needed_only_for_huge_row_groups(tmp_path, monkeypatch):
    ds = load(tmp_path)
    assert browse_copies.status(ds.id).needed is False
    monkeypatch.setattr(module, "SLOW_GROUP_BYTES", 1_000)
    assert browse_copies.status(ds.id).needed is True


def test_build_then_pages_come_from_the_copy(tmp_path, monkeypatch):
    ds = load(tmp_path)
    assert browse_copies.build(ds.id).state in ("building", "ready")
    status = wait_ready(ds.id)
    assert status.state == "ready" and status.size_bytes > 0
    copy = browse_copies.ready_path(ds)
    meta = pq.ParquetFile(copy).metadata
    assert meta.num_rows == ROWS and meta.row_group(0).num_rows == 1_000

    paths = []
    original = row_cache.rows
    monkeypatch.setattr(row_cache, "rows", lambda path, *a: paths.append(path) or original(path, *a))
    page = engine.get_rows(ds.id, offset=4_200, limit=50)
    assert paths == [copy]
    assert [r.data["n"] for r in page.rows] == list(range(4_200, 4_250))
    assert engine.get_row(ds.id, "5499").data == DF.row(5_499, named=True)


def test_commit_rebuilds_the_copy_for_the_new_version(tmp_path):
    ds = load(tmp_path)
    browse_copies.build(ds.id)
    wait_ready(ds.id)
    old = browse_copies.ready_path(ds)
    engine.update_row(ds.id, "4321", {"text": "edited"})
    engine.commit_changes(ds.id, "edit")
    ds = dataset_manager.get_dataset(ds.id)
    assert wait_ready(ds.id).state == "ready"
    new = browse_copies.ready_path(ds)
    assert new != old and not (tmp_path / old).exists()
    assert engine.get_row(ds.id, "4321").data["text"] == "edited"


def test_delete_removes_the_copy(tmp_path):
    ds = load(tmp_path)
    browse_copies.build(ds.id)
    wait_ready(ds.id)
    assert browse_copies.delete(ds.id) is True
    assert browse_copies.status(ds.id).state == "missing"
    assert not (tmp_path / "copies" / ds.id).exists()


def test_csv_copy(tmp_path):
    ds = load(tmp_path, "rows.csv")
    browse_copies.build(ds.id)
    assert wait_ready(ds.id).state == "ready"
    page = engine.get_rows(ds.id, offset=2_990, limit=20)
    assert [r.data["text"] for r in page.rows] == [f"row {i}" for i in range(2_990, 3_010)]
