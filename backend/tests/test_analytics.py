"""Column distributions, including nested columns."""
import polars as pl
import pytest

from app.models.schemas import LoadDatasetRequest
from app.services.analytics import analytics_engine
from app.services.data_loader import dataset_manager


@pytest.fixture()
def dataset(tmp_path, monkeypatch):
    monkeypatch.setattr(dataset_manager, "registry_path", tmp_path / "datasets.json")
    monkeypatch.setattr(dataset_manager, "datasets", {})
    monkeypatch.setattr(dataset_manager, "dataframes", {})
    monkeypatch.setattr(dataset_manager, "options", {})
    path = tmp_path / "data.parquet"
    pl.DataFrame({
        "groups": [["a", "b"], ["a"], None, [], ["c", "a"]],
        "meta": [{"x": 1}, {"x": 1}, {"x": 2}, None, {"x": 3}],
        "tags": [[{"k": 1}], [{"k": 1}, {"k": 2}], None, [], None],
        "name": ["x", "y", "x", None, "x"],
    }).write_parquet(path)
    return dataset_manager.load_dataset(LoadDatasetRequest(path=str(path)))


def dist(ds, column):
    result = analytics_engine.get_column_distribution(ds.id, column)
    return dict(zip(result["values"], result["counts"])), result


def test_list_columns_count_items(dataset):
    counts, result = dist(dataset, "groups")
    assert counts == {"a": 3, "b": 1, "c": 1} and result["total_unique"] == 3 and result["note"]


def test_struct_values_are_json_and_nulls_dropped(dataset):
    assert dist(dataset, "meta")[0] == {'{"x":1}': 2, '{"x":2}': 1, '{"x":3}': 1}
    assert dist(dataset, "tags")[0] == {'{"k":1}': 2, '{"k":2}': 1}


def test_number_lists_get_item_histogram(tmp_path, dataset):
    path = tmp_path / "scores.parquet"
    pl.DataFrame({"scores": pl.Series([[0.1, 0.9], [0.5, 0.5], None], dtype=pl.Array(pl.Float64, 2))}).write_parquet(path)
    ds = dataset_manager.load_dataset(LoadDatasetRequest(path=str(path)))
    result = analytics_engine.get_column_distribution(ds.id, "scores", bins=4)
    assert result["type"] == "histogram" and sum(result["bins"]) == 4
    assert len(result["bin_edges"]) == len(result["bins"]) + 1 and result["stats"]["max"] == 0.9


def test_text_columns(dataset):
    assert dist(dataset, "name")[0] == {"x": 3, "y": 1}
