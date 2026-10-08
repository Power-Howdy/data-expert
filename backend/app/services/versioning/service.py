"""Git-like version control for data files: every save is a commit; any earlier version can be viewed, compared,
restored or exported. Row edits cost a reverse delta (KBs), not a copy of the file."""
import getpass
import hashlib
import logging
import os
import re
import shutil
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import polars as pl

from app.models.schemas import DataFormat, Dataset, LoadDatasetRequest, RowData
from app.models.version_schemas import (
    RowDiff, SaveVersionRequest, SchemaChange, VersionColumn, VersionCommit, VersionDiff, VersionHistory, VersionInfo,
    VersionRows, VersionStats,
)
from app.services.changes import IDX
from app.services.data_loader import data_loader, dataset_manager
from app.services.versioning.deltas import build_undo
from app.services.versioning.rebuild import Rebuilder
from app.services.versioning.repository import Repository, fingerprint

logger = logging.getLogger(__name__)
SINKS = {DataFormat.PARQUET: "sink_parquet", DataFormat.JSONL: "sink_ndjson", DataFormat.CSV: "sink_csv"}
TAG_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$")
DIFF_SAMPLE = 5
HASH = "__dx_hash"


def write_frame(lf: pl.LazyFrame, path: Path, fmt: DataFormat) -> None:
    if fmt == DataFormat.CSV and any(isinstance(t, (pl.List, pl.Struct, pl.Array)) for t in lf.collect_schema().values()):
        raise ValueError("CSV cannot store list or nested columns")
    sink = SINKS.get(fmt)
    if sink:
        try:
            return getattr(lf, sink)(path)
        except Exception as e:
            logger.info(f"Streaming write failed, falling back to in-memory write: {e}")
            path.unlink(missing_ok=True)
    data_loader.write(lf.collect(), str(path), fmt)


def _author() -> str:
    try:
        return getpass.getuser()
    except Exception:
        return ""


class VersionControl:
    def __init__(self):
        self._lock = threading.RLock()

    # ---------- helpers ----------

    @staticmethod
    def _dataset(dataset_id: str) -> Dataset:
        dataset = dataset_manager.get_dataset(dataset_id)
        if not dataset:
            raise KeyError(f"Dataset {dataset_id} not found")
        return dataset

    @staticmethod
    def _reload(dataset: Dataset) -> Dataset:
        return dataset_manager.load_dataset(LoadDatasetRequest(
            path=dataset.path, name=dataset.name, format=dataset.format,
            options=dataset_manager.options.get(dataset.id) or {},
        ))

    def _rebuilder(self, dataset: Dataset, repo: Repository) -> Rebuilder:
        options = dataset_manager.options.get(dataset.id) or {}
        return Rebuilder(
            repo,
            live=lambda: dataset_manager.get_dataframe(dataset.id),
            read=lambda path: data_loader._read_lazy(str(path), dataset.format, **options),
        )

    def _commit(self, repo: Repository, dataset: Dataset, commit_id: str, kind: str, message: str, **fields) -> VersionCommit:
        return VersionCommit(
            id=commit_id, parent=repo.head, kind=kind, message=message, author=_author(),
            row_count=dataset.row_count, size_bytes=dataset.size_bytes,
            columns=[VersionColumn(name=c.name, type=c.type.value) for c in dataset.columns_schema],
            fingerprint=fingerprint(Path(dataset.path)), **fields,
        )

    @staticmethod
    def _new_id(message: str) -> str:
        return hashlib.sha1(f"{uuid.uuid4()}{datetime.now().isoformat()}{message}".encode()).hexdigest()

    def _ready(self, dataset: Dataset, repo: Repository) -> Dataset:
        """Start tracking if needed, and record changes made to the file outside the app."""
        path = Path(dataset.path)
        stat = path.stat()
        if stat.st_size != dataset.size_bytes or abs(stat.st_mtime - dataset.last_modified.timestamp()) >= 1:
            dataset = self._reload(dataset)
        if not repo.exists:
            repo.add(self._commit(repo, dataset, self._new_id("baseline"), "baseline", "Started tracking"))
            repo.save()
        elif repo.head_commit() and repo.head_commit().fingerprint != fingerprint(path):
            repo.add(self._commit(repo, dataset, self._new_id("external"), "external", "Changed outside Data Expert"))
            repo.save()
        return dataset

    def _write(
        self, dataset: Dataset, repo: Repository, lf: pl.LazyFrame, kind: str, message: str,
        undo: str, prepare: Optional[Callable[[str], Dict[str, Any]]] = None,
        ops: Optional[List[Dict[str, Any]]] = None, **fields,
    ) -> VersionCommit:
        """Write a new version to the data file and record it as the head commit."""
        path = Path(dataset.path)
        commit_id = self._new_id(message)
        tmp = path.with_name(f".{path.stem}.dx-tmp{path.suffix}")
        undo_meta: Dict[str, Any] = dict(fields.pop("undo_meta", {}))
        try:
            write_frame(lf, tmp, dataset.format)
            if prepare:
                undo_meta.update(prepare(commit_id))
            if undo == "snapshot":
                repo.take_snapshot(commit_id)
            os.replace(tmp, path)
        except Exception:
            repo.remove_snapshot(commit_id)
            shutil.rmtree(repo.undo_dir(commit_id), ignore_errors=True)
            raise
        finally:
            tmp.unlink(missing_ok=True)
        reloaded = self._reload(dataset)
        commit = self._commit(repo, reloaded, commit_id, kind, message, undo=undo, undo_meta=undo_meta, **fields)
        repo.add(commit, ops)
        self._prune(repo)
        repo.save()
        return commit

    @staticmethod
    def _prune(repo: Repository) -> None:
        snapshots = [c for c in reversed(repo.commits) if c.undo == "snapshot" and repo.has_snapshot(c.id)]
        for commit in snapshots[repo.keep_snapshots:]:
            repo.remove_snapshot(commit.id)

    def _info(self, repo: Repository, available: List[bool]) -> List[VersionInfo]:
        tags: Dict[str, List[str]] = {}
        for name, commit_id in repo.tags.items():
            tags.setdefault(commit_id, []).append(name)
        return [
            VersionInfo(
                **c.model_dump(), head=c.id == repo.head, tags=sorted(tags.get(c.id, [])),
                available=available[i], storage_bytes=repo.storage_bytes(c.id),
            )
            for i, c in enumerate(repo.commits)
        ]

    # ---------- commits ----------

    def history(self, dataset_id: str) -> VersionHistory:
        with self._lock:
            dataset = self._dataset(dataset_id)
            repo = Repository(Path(dataset.path))
            if not repo.exists:
                return VersionHistory(tracking=False, storage_path=str(repo.root))
            dataset = self._ready(dataset, repo)
            infos = self._info(repo, self._rebuilder(dataset, repo).available())
            return VersionHistory(
                tracking=True, head=repo.head, commits=list(reversed(infos)), keep_snapshots=repo.keep_snapshots,
                storage_bytes=repo.total_bytes(), storage_path=str(repo.root),
            )

    def start(self, dataset_id: str) -> VersionHistory:
        with self._lock:
            dataset = self._dataset(dataset_id)
            self._ready(dataset, Repository(Path(dataset.path)))
        return self.history(dataset_id)

    def commit_edits(
        self, dataset_id: str, child: pl.LazyFrame, ops: List[Dict[str, Any]], message: str,
        labels: List[str], stats: Dict[str, int],
    ) -> VersionCommit:
        """Save pending edits. `child` is the edited data with the IDX column (rows keep their parent position)."""
        with self._lock:
            dataset = self._dataset(dataset_id)
            repo = Repository(Path(dataset.path))
            dataset = self._ready(dataset, repo)
            parent = dataset_manager.get_dataframe(dataset.id).with_row_index(IDX).with_columns(pl.col(IDX).cast(pl.Int64))
            transforms = any(o["type"] == "transform" for o in ops)
            touched = sorted(
                {c for o in ops if o["type"] == "update" for c in o["values"]}
                | {o["column"] for o in ops if o["type"] == "replace"}
            )

            def prepare(commit_id: str) -> Dict[str, Any]:
                deleted, cells, meta = build_undo(parent, child, touched)
                if deleted is not None:
                    repo.write_undo(commit_id, "deleted", deleted)
                if cells is not None:
                    repo.write_undo(commit_id, "cells", cells)
                return meta

            return self._write(
                dataset, repo, child.drop(IDX), "edit", message, undo="snapshot" if transforms else "delta",
                prepare=None if transforms else prepare, ops=ops,
                stats=VersionStats(**stats), changes=labels[:50],
            )

    def restore(self, dataset_id: str, ref: str) -> VersionCommit:
        """Make an earlier version current again, as a new commit (history is kept, like `git revert`)."""
        with self._lock:
            dataset = self._dataset(dataset_id)
            repo = Repository(Path(dataset.path))
            if not repo.exists:
                raise ValueError("This dataset has no version history yet")
            dataset = self._ready(dataset, repo)
            target = repo.get(ref)
            if target.id == repo.head:
                raise ValueError("This is already the current version")
            lf = self._rebuilder(dataset, repo).frame(target.id)
            later = repo.commits[repo.index(target.id) + 1:]
            replayable = all(c.kind == "edit" for c in later)
            return self._write(
                dataset, repo, lf, "restore", f"Restored version {target.id[:7]}: {target.message}",
                undo="replay" if replayable else "snapshot", restored_from=target.id,
                undo_meta={"replay": [c.id for c in later]} if replayable else {},
            )

    # ---------- reading versions ----------

    def frame(self, dataset_id: str, ref: str) -> pl.LazyFrame:
        with self._lock:
            dataset = self._dataset(dataset_id)
            repo = Repository(Path(dataset.path))
            if not repo.exists:
                raise KeyError("This dataset has no version history yet")
            dataset = self._ready(dataset, repo)
            return self._rebuilder(dataset, repo).frame(repo.get(ref).id)

    def rows(self, dataset_id: str, ref: str, offset: int, limit: int) -> VersionRows:
        lf = self.frame(dataset_id, ref)
        total = lf.select(pl.len()).collect().item()
        df = lf.slice(offset, limit).collect()
        rows = [RowData(id=str(offset + i), data=r) for i, r in enumerate(df.iter_rows(named=True))]
        return VersionRows(schema=data_loader.get_schema(lf), rows=rows, total=total, offset=offset, limit=limit)

    def diff(self, dataset_id: str, a: str, b: str, rows: bool = False) -> VersionDiff:
        history = self.history(dataset_id)
        by_id = {c.id: c for c in history.commits}
        repo = Repository(Path(self._dataset(dataset_id).path))
        older, newer = repo.get(a), repo.get(b)
        if repo.index(older.id) > repo.index(newer.id):
            older, newer = newer, older
        before = {c.name: c.type for c in older.columns}
        after = {c.name: c.type for c in newer.columns}
        changes = [
            SchemaChange(name=n, before=before.get(n), after=after.get(n))
            for n in list(before) + [n for n in after if n not in before] if before.get(n) != after.get(n)
        ]
        between = repo.commits[repo.index(older.id) + 1: repo.index(newer.id) + 1]
        result = VersionDiff(
            from_id=older.id, to_id=newer.id, row_delta=newer.row_count - older.row_count,
            schema_changes=changes, commits=[by_id[c.id] for c in between],
        )
        if rows:
            result.rows = self._row_diff(self.frame(dataset_id, older.id), self.frame(dataset_id, newer.id), before, after)
        return result

    @staticmethod
    def _row_diff(old: pl.LazyFrame, new: pl.LazyFrame, before: Dict[str, str], after: Dict[str, str]) -> RowDiff:
        common = [c for c in before if after.get(c) == before[c]]
        if not common:
            raise ValueError("The versions have no columns in common to compare")
        hashed_old = old.select(common).with_columns(pl.struct(common).hash().alias(HASH))
        hashed_new = new.select(common).with_columns(pl.struct(common).hash().alias(HASH))
        removed = hashed_old.join(hashed_new.select(HASH), on=HASH, how="anti")
        added = hashed_new.join(hashed_old.select(HASH), on=HASH, how="anti")
        sample = lambda lf: lf.drop(HASH).head(DIFF_SAMPLE).collect().to_dicts()
        return RowDiff(
            compared_columns=common,
            only_in_from=removed.select(pl.len()).collect().item(),
            only_in_to=added.select(pl.len()).collect().item(),
            removed_sample=sample(removed), added_sample=sample(added),
        )

    def save_as(self, dataset_id: str, ref: str, request: SaveVersionRequest) -> Dataset:
        from app.services.save_as import write_new_dataset

        return write_new_dataset(self._dataset(dataset_id), self.frame(dataset_id, ref), request.name, request.format, request.overwrite)

    # ---------- tags & settings ----------

    def _existing(self, dataset_id: str) -> Repository:
        repo = Repository(Path(self._dataset(dataset_id).path))
        if not repo.exists:
            raise ValueError("This dataset has no version history yet")
        return repo

    def tag(self, dataset_id: str, name: str, ref: str) -> VersionHistory:
        with self._lock:
            repo = self._existing(dataset_id)
            if not TAG_RE.match(name):
                raise ValueError("Tag names use letters, digits, '.', '_' or '-' (up to 40 characters)")
            repo.tags[name] = repo.get(ref).id
            repo.save()
        return self.history(dataset_id)

    def untag(self, dataset_id: str, name: str) -> VersionHistory:
        with self._lock:
            repo = self._existing(dataset_id)
            if repo.tags.pop(name, None) is None:
                raise KeyError(f"Tag '{name}' not found")
            repo.save()
        return self.history(dataset_id)

    def configure(self, dataset_id: str, keep_snapshots: int) -> VersionHistory:
        with self._lock:
            repo = self._existing(dataset_id)
            repo.keep_snapshots = keep_snapshots
            self._prune(repo)
            repo.save()
        return self.history(dataset_id)

    def destroy(self, dataset_id: str) -> None:
        with self._lock:
            Repository(Path(self._dataset(dataset_id).path)).destroy()


version_control = VersionControl()
