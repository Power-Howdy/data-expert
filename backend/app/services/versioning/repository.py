"""On-disk version history of one data file, kept in <folder>/.data-expert-history/<file name>/ (like a .git folder).

The data file itself is always the newest version. Each commit stores what is needed to go one version back:

history.json          commits (linear, oldest first), head, tags and settings
ops/<id>.json         the commit's edit operations (forward delta, replayable on its parent)
undo/<id>/*.parquet   reverse delta: rows the commit deleted and old values of cells it changed
snapshots/<id>        full copy of the commit's parent; a hardlink of the replaced file, so taking it copies nothing
"""
import json
import logging
import os
import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional

import polars as pl

from app.models.version_schemas import VersionCommit

logger = logging.getLogger(__name__)
HISTORY_DIR = ".data-expert-history"
DEFAULT_KEEP_SNAPSHOTS = 5


def fingerprint(path: Path) -> str:
    stat = path.stat()
    return f"{stat.st_size}:{stat.st_mtime_ns}"


def _size(path: Path) -> int:
    if path.is_file():
        return path.stat().st_size
    return sum(p.stat().st_size for p in path.rglob("*") if p.is_file()) if path.exists() else 0


class Repository:
    def __init__(self, data_path: Path):
        self.data_path = data_path
        self.root = data_path.parent / HISTORY_DIR / data_path.name
        self.meta_path = self.root / "history.json"
        self.commits: List[VersionCommit] = []
        self.head: Optional[str] = None
        self.tags: Dict[str, str] = {}
        self.keep_snapshots = DEFAULT_KEEP_SNAPSHOTS
        if self.meta_path.exists():
            self._load()

    @property
    def exists(self) -> bool:
        return self.meta_path.exists()

    def _load(self) -> None:
        state = json.loads(self.meta_path.read_text(encoding="utf-8"))
        self.commits = [VersionCommit(**c) for c in state.get("commits", [])]
        self.head = state.get("head")
        self.tags = state.get("tags", {})
        self.keep_snapshots = state.get("keep_snapshots", DEFAULT_KEEP_SNAPSHOTS)

    def save(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        state = {
            "format": 1, "file": self.data_path.name, "head": self.head, "tags": self.tags,
            "keep_snapshots": self.keep_snapshots, "commits": [c.model_dump(mode="json") for c in self.commits],
        }
        tmp = self.meta_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(state, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        os.replace(tmp, self.meta_path)

    # ---------- commits ----------

    def get(self, ref: str) -> VersionCommit:
        """A commit by id, unique id prefix (like git) or tag name."""
        ref = self.tags.get(ref, ref)
        matches = [c for c in self.commits if c.id.startswith(ref)] if len(ref) >= 4 else []
        if len(matches) != 1:
            raise KeyError(f"Version '{ref}' not found" if not matches else f"Version id '{ref}' is ambiguous")
        return matches[0]

    def index(self, commit_id: str) -> int:
        return next(i for i, c in enumerate(self.commits) if c.id == commit_id)

    def head_commit(self) -> Optional[VersionCommit]:
        return self.get(self.head) if self.head else None

    def add(self, commit: VersionCommit, ops: Optional[List[Dict[str, Any]]] = None) -> None:
        if ops:
            path = self.root / "ops" / f"{commit.id}.json"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(ops, default=str, ensure_ascii=False), encoding="utf-8")
        self.commits.append(commit)
        self.head = commit.id

    def load_ops(self, commit_id: str) -> List[Dict[str, Any]]:
        path = self.root / "ops" / f"{commit_id}.json"
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else []

    # ---------- reverse deltas ----------

    def undo_dir(self, commit_id: str) -> Path:
        return self.root / "undo" / commit_id

    def write_undo(self, commit_id: str, name: str, df: pl.DataFrame) -> None:
        folder = self.undo_dir(commit_id)
        folder.mkdir(parents=True, exist_ok=True)
        df.write_parquet(folder / f"{name}.parquet", compression="zstd")

    def read_undo(self, commit_id: str, name: str) -> Optional[pl.DataFrame]:
        path = self.undo_dir(commit_id) / f"{name}.parquet"
        return pl.read_parquet(path) if path.exists() else None

    # ---------- snapshots ----------

    def snapshot_path(self, commit_id: str) -> Path:
        return self.root / "snapshots" / f"{commit_id}{self.data_path.suffix}"

    def has_snapshot(self, commit_id: str) -> bool:
        return self.snapshot_path(commit_id).exists()

    def take_snapshot(self, commit_id: str) -> None:
        """Keep the current file as the parent content of `commit_id`. Call right before the file is replaced."""
        target = self.snapshot_path(commit_id)
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            os.link(self.data_path, target)
        except OSError:
            shutil.copy2(self.data_path, target)

    def remove_snapshot(self, commit_id: str) -> bool:
        try:
            self.snapshot_path(commit_id).unlink(missing_ok=True)
            return True
        except OSError as e:
            logger.info(f"Could not remove snapshot {commit_id} (in use?): {e}")
            return False

    # ---------- storage ----------

    def storage_bytes(self, commit_id: str) -> int:
        return (
            _size(self.snapshot_path(commit_id)) + _size(self.undo_dir(commit_id))
            + _size(self.root / "ops" / f"{commit_id}.json")
        )

    def total_bytes(self) -> int:
        return _size(self.root)

    def destroy(self) -> None:
        shutil.rmtree(self.root, ignore_errors=True)
        parent = self.root.parent
        if parent.exists() and not any(parent.iterdir()):
            parent.rmdir()
