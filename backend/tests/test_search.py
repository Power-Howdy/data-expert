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
    assert search.state(ds) == "not_needed"
    found = search.search(ds.id, SearchRequest(query="plant"))
    assert found.mode == "scan" and ids(found) == ["0", "2"] and found.total == 2
    assert found.results[0].data["views"] == 10
    assert ids(search.search(ds.id, SearchRequest(query="plants growth"))) == ["2"]
    engine.update_row(ds.id, "1", {"title": "Plant cells"})
    engine.delete_row(ds.id, "0")
    assert ids(search.search(ds.id, SearchRequest(query="plant"))) == ["1", "2"]
    with pytest.raises(ValueError):
        search.search(ds.id, SearchRequest(query="  "))


@pytest.fixture()
def indexed(monkeypatch):
    monkeypatch.setattr(search_module, "SCAN_LIMIT_BYTES", 0)
    monkeypatch.setattr(search_module, "MIN_BLOCK_ROWS", 10)
    monkeypatch.setattr(search_module, "DATA_PER_FINGERPRINT", 0)
    monkeypatch.setattr(search_module, "INDEX_RATIO", 1e-9)


def wait_ready(search, dataset_id):
    for _ in range(200):
        if search.status(dataset_id).state == "ready":
            return
        time.sleep(0.05)
    raise TimeoutError("index was not built")


def test_large_files_use_a_background_index(setup, indexed):
    ds, search = setup
    assert search.state(ds) == "missing"
    first = search.search(ds.id, SearchRequest(query="photosynthesis"))
    assert first.mode == "index" and first.index.state in ("building", "ready")
    wait_ready(search, ds.id)
    assert search.state(ds) == "ready"

    found = search.search(ds.id, SearchRequest(query="photosynthesis"))
    assert ids(found) == ["0"] and found.results[0].data["meta"] == {"topic": "plants"} and found.total_exact
    assert ids(search.search(ds.id, SearchRequest(query="SYNTH"))) == ["0"]
    assert ids(search.search(ds.id, SearchRequest(query="plants growth"))) == ["2"]
    engine.update_row(ds.id, "2", {"views": 99})
    engine.update_row(ds.id, "1", {"title": "Plant cells"})
    engine.delete_row(ds.id, "0")
    found = search.search(ds.id, SearchRequest(query="plant"))
    assert {r.row_id: r.data["views"] for r in found.results} == {"1": 20, "2": 99}

    search.delete_index(ds.id)
    assert search.status(ds.id).state == "missing"


def test_index_scans_only_blocks_that_can_match(tmp_path, setup, indexed, monkeypatch):
    _, search = setup
    path = tmp_path / "many.csv"
    words = ["needle in the haystack" if i in (37, 81) else f"plain row number {i}" for i in range(100)]
    pl.DataFrame({"n": list(range(100)), "text": words}).write_csv(path)
    ds = dataset_manager.load_dataset(LoadDatasetRequest(path=str(path)))
    search.build_index(ds.id)
    wait_ready(search, ds.id)
    meta, blocks = search.candidate_blocks(ds.id, search._key(ds.path), ["Needle", "hay"])
    assert meta["blocks"] == 10 and blocks == [3, 8]
    assert search.status(ds.id).size_bytes < 10 * search_module.BLOCK_BITS // 8 + 10_000

    found = search.search(ds.id, SearchRequest(query="needle"))
    assert ids(found) == ["37", "81"] and found.total == 2 and found.total_exact
    assert found.results[1].data == {"n": 81, "text": "needle in the haystack"}

    monkeypatch.setattr(search_module, "COUNT_BUDGET_S", -1)
    partial = search.search(ds.id, SearchRequest(query="plain row", limit=5))
    assert ids(partial) == ["0", "1", "2", "3", "4"] and not partial.total_exact and partial.total >= 5


def test_index_search_over_the_browse_copy_matches_a_full_scan(tmp_path, setup, indexed, monkeypatch):
    from app.services import browse_copy as copy_module
    from app.services.browse_copy import browse_copies

    _, search = setup
    monkeypatch.setattr(browse_copies, "base", tmp_path / "copies")
    monkeypatch.setattr(copy_module, "BROWSE_GROUP_ROWS", 7)
    path = tmp_path / "mixed.parquet"
    pl.DataFrame({
        "n": list(range(100)),
        "text": ["needle 0.5 here" if i % 30 == 7 else f"row {i}" for i in range(100)],
        "score": [0.5 if i % 9 == 0 else i / 3 for i in range(100)],
        "tags": [[i % 4, 37] if i % 11 == 0 else [i % 4] for i in range(100)],
        "labels": [["red", "Needle"] if i % 13 == 0 else ["blue"] for i in range(100)],
    }).write_parquet(path)
    ds = dataset_manager.load_dataset(LoadDatasetRequest(path=str(path)))
    browse_copies.build(ds.id)
    for _ in range(200):
        if browse_copies.status(ds.id).state != "building":
            break
        time.sleep(0.05)
    assert browse_copies.ready_path(ds)
    search.build_index(ds.id)
    wait_ready(search, ds.id)
    for query in ["needle", "0.5", "needle 0.5", "37", "RED needle", "row 9", "e"]:
        found = search.search(ds.id, SearchRequest(query=query, limit=1000))
        monkeypatch.setattr(search_module, "SCAN_LIMIT_BYTES", 1 << 40)
        expected = search.search(ds.id, SearchRequest(query=query, limit=1000))
        monkeypatch.setattr(search_module, "SCAN_LIMIT_BYTES", 0)
        assert found.mode == "index" and expected.mode == "scan"
        assert ids(found) == ids(expected) and found.total == expected.total, query
        assert [r.data for r in found.results] == [r.data for r in expected.results], query
    page = search.search(ds.id, SearchRequest(query="row", offset=40, limit=5))
    assert ids(page) == ["42", "43", "44", "45", "46"]
    assert list(page.results[0].data) == ["n", "text", "score", "tags", "labels"]
    browse_copies.delete(ds.id)


def test_word_list_prunes_blocks_the_snippets_cannot(tmp_path, setup, indexed):
    _, search = setup
    path = tmp_path / "words.csv"
    text = ["Once a DEADENDS story, job done" if i == 37 else f"dead ends made dens {i}" for i in range(100)]
    pl.DataFrame({"text": text}).write_csv(path)
    ds = dataset_manager.load_dataset(LoadDatasetRequest(path=str(path)))
    search.build_index(ds.id)
    wait_ready(search, ds.id)
    key = search._key(ds.path)
    assert search.candidate_blocks(ds.id, key, ["deadend"])[1] == [3]
    assert search.candidate_blocks(ds.id, key, ["deadend", "made"])[1] == [3]
    assert search.candidate_blocks(ds.id, key, ["Dead-End"])[1] == []
    assert search.candidate_blocks(ds.id, key, ["Dead"])[1] == list(range(10))
    assert ids(search.search(ds.id, SearchRequest(query="deadend job"))) == ["37"]
    assert ids(search.search(ds.id, SearchRequest(query="EADEN"))) == ["37"]
    assert search.search(ds.id, SearchRequest(query="deadend made")).total == 0
