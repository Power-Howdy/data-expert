"""Row editing, find & replace, transforms and commit; run from the backend directory: python -m pytest tests"""
import polars as pl
import pytest

from app.models.schemas import FilterParams, LoadDatasetRequest, ReplaceRequest
from app.services.data_loader import dataset_manager
from app.services.manipulation import manipulation_engine as engine


@pytest.fixture()
def make_dataset(tmp_path, monkeypatch):
    monkeypatch.setattr(dataset_manager, "registry_path", tmp_path / "datasets.json")
    monkeypatch.setattr(dataset_manager, "datasets", {})
    monkeypatch.setattr(dataset_manager, "dataframes", {})
    monkeypatch.setattr(dataset_manager, "options", {})

    def make(fmt="parquet"):
        df = pl.DataFrame({
            "name": ["Ann", "bob", "Cid", None],
            "age": [31, 25, 40, 19],
            "info": [{"city": "Pune", "zip": "1"}, {"city": "Oslo", "zip": "2"}, None, {"city": "Rome", "zip": "3"}],
        })
        path = tmp_path / f"people.{fmt}"
        df.write_parquet(path) if fmt == "parquet" else df.write_ndjson(path)
        dataset = dataset_manager.load_dataset(LoadDatasetRequest(path=str(path)))
        engine.discard_changes(dataset.id)
        return dataset

    return make


def names(dataset_id, **kwargs):
    return [r.data["name"] for r in engine.get_rows(dataset_id, 0, 100, **kwargs).rows]


def test_row_ids_are_stable_positions(make_dataset):
    ds = make_dataset()
    page = engine.get_rows(ds.id, 1, 2)
    assert [r.id for r in page.rows] == ["1", "2"]
    filtered = engine.get_rows(ds.id, 0, 10, filters=[FilterParams(column="age", operator="gt", value="30")])
    assert [r.id for r in filtered.rows] == ["0", "2"]


def test_update_delete_add_and_undo(make_dataset):
    ds = make_dataset()
    row = engine.update_row(ds.id, "1", {"name": "Bob", "age": "26", "info": {"city": "Bergen", "zip": "9"}})
    assert row.data["age"] == 26 and row.data["info"]["city"] == "Bergen"
    engine.delete_row(ds.id, "0")
    added = engine.add_row(ds.id, {"name": "Dee", "age": 50})
    assert added.data == {"name": "Dee", "age": 50, "info": None}
    assert names(ds.id) == ["Bob", "Cid", None, "Dee"]
    engine.update_row(ds.id, added.id, {"age": 51})
    assert engine.get_row(ds.id, added.id).data["age"] == 51
    assert engine.summary(ds.id).total == 4
    engine.undo(ds.id)
    engine.undo(ds.id)
    assert names(ds.id) == ["Bob", "Cid", None]
    with pytest.raises(ValueError, match="not a valid"):
        engine.update_row(ds.id, "2", {"age": "old"})


def test_replace_modes(make_dataset):
    ds = make_dataset()
    contains = ReplaceRequest(column="name", old_value="B", new_value="$X", mode="contains", case_sensitive=False)
    assert engine.count_matches(ds.id, contains) == 1
    assert engine.replace_values(ds.id, contains) == 1
    assert engine.replace_values(ds.id, ReplaceRequest(column="name", old_value=r"^(\w)nn$", new_value="${1}NN", mode="regex")) == 1
    assert engine.replace_values(ds.id, ReplaceRequest(column="age", old_value="40", new_value="41")) == 1
    assert names(ds.id)[:2] == ["ANN", "$Xo$X"]
    assert engine.get_row(ds.id, "2").data["age"] == 41


def test_transform_renumbers_rows(make_dataset):
    ds = make_dataset()
    engine.transform(ds.id, [{"op": "sort_rows", "params": {"columns": ["age"]}}])
    rows = engine.get_rows(ds.id, 0, 10).rows
    assert [r.data["age"] for r in rows] == [19, 25, 31, 40] and rows[0].id == "0"
    engine.update_row(ds.id, "0", {"name": "Youngest"})
    assert names(ds.id)[0] == "Youngest"
    with pytest.raises(Exception):
        engine.transform(ds.id, [{"op": "top_n", "params": {"column": "missing"}}])


def test_apply_refined_view_uses_whole_lineage(make_dataset):
    from app.api.ai_routes import apply_view
    from app.models.ai_schemas import PlanStep
    from app.services.ai.views import view_store

    ds = make_dataset()
    base = dataset_manager.get_dataframe(ds.id)
    first = view_store.create(ds.id, base, "adults", [PlanStep(op="filter_range", params={"column": "age", "min": 20})])
    sort = PlanStep(op="sort_rows", params={"columns": ["age"], "descending": True})
    refined = view_store.create(ds.id, base, "oldest first", [sort], parent_view_id=first.id)
    assert apply_view(refined.id)["steps"] == 2
    assert names(ds.id) == ["Cid", "Ann", "bob"]


@pytest.mark.parametrize("fmt", ["parquet", "jsonl"])
def test_commit_writes_file(make_dataset, fmt):
    ds = make_dataset(fmt)
    engine.update_row(ds.id, "3", {"name": "Zed"})
    engine.delete_row(ds.id, "1")
    engine.add_row(ds.id, {"name": "New", "age": 1})
    assert engine.commit_changes(ds.id).row_count == 4
    assert not engine.has_changes(ds.id)
    written = pl.read_parquet(ds.path) if fmt == "parquet" else pl.read_ndjson(ds.path)
    assert written["name"].to_list() == ["Ann", "Cid", "Zed", "New"]
    assert dataset_manager.get_dataset(ds.id).row_count == 4
