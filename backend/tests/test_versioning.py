"""Version history: commits, rebuilding old versions, restore, tags, pruning and diffs."""
import os
import time
from pathlib import Path

import polars as pl
import pytest

from app.models.schemas import LoadDatasetRequest, ReplaceRequest
from app.models.version_schemas import SaveVersionRequest
from app.services.data_loader import dataset_manager
from app.services.manipulation import manipulation_engine as engine
from app.services.versioning.repository import Repository
from app.services.versioning.service import version_control as vc

ORIGINAL = pl.DataFrame({
    "name": ["Ann", "bob", "Cid", None, "Eve", "Fay"],
    "age": [31, 25, 40, 19, 52, 33],
    "info": [{"city": "Pune"}, {"city": "Oslo"}, None, {"city": "Rome"}, {"city": "Lima"}, {"city": "Kyiv"}],
})


@pytest.fixture()
def dataset(tmp_path, monkeypatch):
    monkeypatch.setattr(dataset_manager, "registry_path", tmp_path / "datasets.json")
    monkeypatch.setattr(dataset_manager, "datasets", {})
    monkeypatch.setattr(dataset_manager, "dataframes", {})
    monkeypatch.setattr(dataset_manager, "options", {})
    path = tmp_path / "people.parquet"
    ORIGINAL.write_parquet(path)
    ds = dataset_manager.load_dataset(LoadDatasetRequest(path=str(path)))
    engine.discard_changes(ds.id)
    return ds


def current(ds) -> pl.DataFrame:
    return pl.read_parquet(ds.path)


def version(ds, ref) -> pl.DataFrame:
    return vc.frame(ds.id, ref).collect()


def test_row_edits_store_reverse_deltas_and_rebuild_every_version(dataset):
    ds = dataset
    saved = [ORIGINAL]
    engine.update_row(ds.id, "1", {"name": "Bob", "info": {"city": "Bergen"}})
    engine.delete_row(ds.id, "0")
    engine.delete_row(ds.id, "4")
    engine.add_row(ds.id, {"name": "Gus", "age": 7})
    c1 = engine.commit_changes(ds.id, "first edits")
    saved.append(current(ds))
    assert c1.undo == "delta" and c1.message == "first edits" and c1.stats.deleted == 2

    engine.replace_values(ds.id, ReplaceRequest(column="age", old_value="40", new_value="41"))
    engine.delete_row(ds.id, "4")
    engine.update_row(ds.id, "0", {"age": None})
    c2 = engine.commit_changes(ds.id)
    saved.append(current(ds))
    assert c2.message.startswith("3 changes")

    history = vc.history(ds.id)
    assert [c.kind for c in history.commits] == ["edit", "edit", "baseline"]
    assert all(c.available for c in history.commits)
    for commit, expected in zip(reversed(history.commits), saved):
        assert version(ds, commit.id).equals(expected)
    assert not (Repository(Path(ds.path)).root / "snapshots").exists()


def test_transform_snapshot_and_restore(dataset):
    ds = dataset
    engine.transform(ds.id, [{"op": "sort_rows", "params": {"columns": ["age"]}}])
    commit = engine.commit_changes(ds.id)
    assert commit.undo == "snapshot"
    assert current(ds)["age"].to_list() == sorted(ORIGINAL["age"].to_list())
    baseline = vc.history(ds.id).commits[-1]
    assert version(ds, baseline.id).equals(ORIGINAL)

    restored = vc.restore(ds.id, baseline.id[:8])
    assert restored.kind == "restore" and restored.undo == "replay" and restored.restored_from == baseline.id
    assert current(ds).equals(ORIGINAL)
    assert version(ds, commit.id)["age"].to_list() == sorted(ORIGINAL["age"].to_list())
    with pytest.raises(ValueError, match="already"):
        vc.restore(ds.id, restored.id)


def test_restore_after_edits_replays_forward_ops(dataset):
    ds = dataset
    engine.update_row(ds.id, "2", {"name": "Cyd"})
    edited = engine.commit_changes(ds.id)
    baseline = vc.history(ds.id).commits[-1]
    restored = vc.restore(ds.id, baseline.id)
    assert restored.undo == "replay" and restored.undo_meta["replay"] == [edited.id]
    assert current(ds).equals(ORIGINAL)
    assert version(ds, edited.id)["name"][2] == "Cyd"
    assert version(ds, baseline.id).equals(ORIGINAL)


def test_external_change_is_recorded(dataset):
    ds = dataset
    vc.start(ds.id)
    time.sleep(0.05)
    ORIGINAL.head(2).write_parquet(ds.path)
    os.utime(ds.path, (time.time() + 5, time.time() + 5))
    history = vc.history(ds.id)
    assert [c.kind for c in history.commits] == ["external", "baseline"]
    assert history.commits[0].row_count == 2
    assert not history.commits[1].available
    with pytest.raises(ValueError, match="outside"):
        vc.frame(ds.id, history.commits[1].id)


def test_tags_settings_prune_diff_and_save_as(dataset):
    ds = dataset
    vc.start(ds.id)
    baseline = vc.history(ds.id).head
    vc.tag(ds.id, "v1", baseline)
    with pytest.raises(ValueError):
        vc.tag(ds.id, "bad name!", baseline)
    for column in (["age"], ["name"]):
        engine.transform(ds.id, [{"op": "sort_rows", "params": {"columns": column}}])
        engine.commit_changes(ds.id)
    history = vc.configure(ds.id, 1)
    assert [c.available for c in history.commits] == [True, True, False]
    assert history.commits[-1].tags == ["v1"]
    with pytest.raises(ValueError, match="snapshot"):
        vc.frame(ds.id, "v1")

    engine.delete_row(ds.id, "0")
    engine.commit_changes(ds.id)
    head = vc.history(ds.id).head
    diff = vc.diff(ds.id, head, history.commits[0].id, rows=True)
    assert diff.row_delta == -1 and len(diff.commits) == 1
    assert diff.rows.only_in_from == 1 and diff.rows.only_in_to == 0

    copy = vc.save_as(ds.id, history.commits[0].id, SaveVersionRequest(name="people_v2"))
    assert copy.row_count == 6
    vc.untag(ds.id, "v1")
    vc.destroy(ds.id)
    assert not vc.history(ds.id).tracking
