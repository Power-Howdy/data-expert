"""Search: direct scan for small files, background index for large ones."""
import time

import polars as pl
import pytest

from app.models.schemas import LoadDatasetRequest, SearchRequest
from app.services import search_engine as search_module
from app.services.data_loader import dataset_manager
from app.services.manipulation import manipulation_engine as engine
from app.services.search_engine import SearchEngine


@pytest.fixture()
def setup(tmp_path, monkeypatch):
    monkeypatch.setattr(dataset_manager, "registry_path", tmp_path / "datasets.json")
    monkeypatch.setattr(dataset_manager, "datasets", {})
    monkeypatch.setattr(dataset_manager, "dataframes", {})
    monkeypatch.setattr(dataset_manager, "options", {})
    path = tmp_path / "docs.parquet"
    pl.DataFrame({
        "title": ["Photosynthesis basics", "Cell biology", "Plant growth", None],
        "views": [10, 20, 30, 40],
        "meta": [{"topic": "plants"}, {"topic": "cells"}, {"topic": "Plants"}, {"topic": "rocks"}],
    }).write_parquet(path)
    ds = dataset_manager.load_dataset(LoadDatasetRequest(path=str(path)))
    engine.discard_changes(ds.id)
    return ds, SearchEngine(str(tmp_path / "indexes"))


def ids(response):
    return [r.row_id for r in response.results]


def test_scan_matches_all_terms_nested_values_and_pending_edits(setup):
    ds, search = setup
    found = search.search(ds.id, SearchRequest(query="plant"))
    assert found.mode == "scan" and ids(found) == ["0", "2"] and found.total == 2
    assert found.results[0].data["views"] == 10
    assert ids(search.search(ds.id, SearchRequest(query="plants growth"))) == ["2"]
    engine.update_row(ds.id, "1", {"title": "Plant cells"})
    engine.delete_row(ds.id, "0")
    assert ids(search.search(ds.id, SearchRequest(query="plant"))) == ["1", "2"]
    with pytest.raises(ValueError):
        search.search(ds.id, SearchRequest(query="  "))


def test_large_files_use_a_background_index(setup, monkeypatch):
    ds, search = setup
    monkeypatch.setattr(search_module, "SCAN_LIMIT_BYTES", 0)
    first = search.search(ds.id, SearchRequest(query="photosynthesis"))
    assert first.mode == "index" and first.index.state in ("building", "ready")
    for _ in range(100):
        if search.status(ds.id).state == "ready":
            break
        time.sleep(0.05)
    assert search.status(ds.id).state == "ready"

    found = search.search(ds.id, SearchRequest(query="photosynthesis"))
    assert ids(found) == ["0"] and found.results[0].data["meta"] == {"topic": "plants"}
    assert ids(search.search(ds.id, SearchRequest(query="photosyntesis"))) == ["0"]
    engine.update_row(ds.id, "2", {"views": 99})
    engine.delete_row(ds.id, "0")
    assert {r.row_id: r.data["views"] for r in search.search(ds.id, SearchRequest(query="plants")).results} == {"2": 99}
    assert "photosynthesis" in search.suggest(ds.id, "photo")

    search.delete_index(ds.id)
    assert search.status(ds.id).state == "missing"
