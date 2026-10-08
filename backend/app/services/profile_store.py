import json
import logging
import os
from pathlib import Path
from typing import Optional

from app.core.config import settings
from app.models.schemas import Dataset, DatasetProfile

logger = logging.getLogger(__name__)


def dataset_fingerprint(dataset: Dataset) -> str:
    """Changes whenever the underlying data changes (file edit, commit, reload)."""
    return f"{dataset.size_bytes}:{dataset.last_modified.isoformat()}:{dataset.row_count}:{len(dataset.columns_schema)}"


class ProfileStore:
    """Persist generated dataset profiles next to the dataset registry."""

    def __init__(self, directory: Optional[str] = None):
        self.directory = Path(directory) if directory else Path(settings.data.registry_path).parent / "profiles"

    def _path(self, dataset_id: str) -> Path:
        return self.directory / f"{dataset_id}.json"

    def load(self, dataset: Dataset) -> Optional[DatasetProfile]:
        path = self._path(dataset.id)
        if not path.exists():
            return None
        try:
            entry = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as e:
            logger.warning(f"Could not read saved profile {path}: {e}")
            return None
        if entry.get("fingerprint") != dataset_fingerprint(dataset):
            return None
        return DatasetProfile(**entry["profile"])

    def save(self, dataset: Dataset, profile: DatasetProfile) -> None:
        entry = {"fingerprint": dataset_fingerprint(dataset), "profile": profile.model_dump(mode="json")}
        try:
            self.directory.mkdir(parents=True, exist_ok=True)
            path = self._path(dataset.id)
            tmp = path.with_suffix(".tmp")
            tmp.write_text(json.dumps(entry), encoding="utf-8")
            os.replace(tmp, path)
        except OSError as e:
            logger.warning(f"Could not save profile for {dataset.id}: {e}")

    def delete(self, dataset_id: str) -> None:
        try:
            self._path(dataset_id).unlink(missing_ok=True)
        except OSError as e:
            logger.warning(f"Could not delete profile for {dataset_id}: {e}")


profile_store = ProfileStore()
