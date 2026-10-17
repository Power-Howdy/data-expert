"""Rebuild the data of any version by walking back from the live file (the newest version)."""
from pathlib import Path
from typing import Callable, List

import polars as pl

from app.services.changes import IDX, apply_changes
from app.services.versioning.deltas import apply_undo
from app.services.versioning.repository import Repository


class Rebuilder:
    def __init__(self, repo: Repository, live: Callable[[], pl.LazyFrame], read: Callable[[Path], pl.LazyFrame]):
        self.repo = repo
        self.live = live
        self.read = read

    def _anchor(self, index: int) -> int:
        """Nearest version at or after `index` whose data exists as a file: the live file or a snapshot."""
        commits = self.repo.commits
        for j in range(index, len(commits) - 1):
            child = commits[j + 1]
            if child.undo == "snapshot" and self.repo.has_snapshot(child.id):
                return j
        return len(commits) - 1

    def frame(self, commit_id: str) -> pl.LazyFrame:
        commits = self.repo.commits
        index = self.repo.index(commit_id)
        anchor = self._anchor(index)
        lf = self.live() if anchor == len(commits) - 1 else self.read(self.repo.snapshot_path(commits[anchor + 1].id))
        for j in range(anchor - 1, index - 1, -1):
            lf = self._step_back(lf, commits[j + 1])
        return lf

    def _step_back(self, lf: pl.LazyFrame, child) -> pl.LazyFrame:
        """The parent version of `child`, given child's data."""
        if child.undo == "delta":
            return apply_undo(
                lf, child.undo_meta, self.repo.read_undo(child.id, "deleted"), self.repo.read_undo(child.id, "cells"),
            )
        if child.undo == "replay":
            for commit_id in child.undo_meta.get("replay", []):
                lf = apply_changes(lf, self.repo.load_ops(commit_id)).drop(IDX)
            return lf
        raise ValueError(self.unavailable_reason(child))

    @staticmethod
    def unavailable_reason(child) -> str:
        if child.kind == "external":
            return "The file was changed outside Data Expert, so versions before that change can't be rebuilt"
        if child.undo == "snapshot":
            return "The snapshot needed to rebuild this version was removed to save space"
        return "This version can no longer be rebuilt"

    def available(self) -> List[bool]:
        """Whether each commit (oldest first) can still be rebuilt."""
        commits = self.repo.commits
        result = [False] * len(commits)
        if not commits:
            return result
        result[-1] = True
        for j in range(len(commits) - 2, -1, -1):
            child = commits[j + 1]
            if child.undo == "snapshot":
                result[j] = self.repo.has_snapshot(child.id)
            elif child.undo in ("delta", "replay"):
                result[j] = result[j + 1]
        return result
