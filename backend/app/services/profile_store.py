import json
import logging
import os
from pathlib import Path
from typing import Generic, Optional, Type, TypeVar

from pydantic import BaseModel

from app.core.config import settings
from app.models.ai_schemas import AIInsights
from app.models.schemas import Dataset, DatasetProfile

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


def dataset_fingerprint(dataset: Dataset) -> str:
    """Changes whenever the underlying data changes (file edit, commit, reload)."""
    return f"{dataset.size_bytes}:{dataset.last_modified.isoformat()}:{dataset.row_count}:{len(dataset.columns_schema)}"


class FingerprintStore(Generic[T]):
    """Persist per-dataset results next to the registry; stale entries are ignored."""

    def __init__(self, subdir: str, model: Type[T], directory: Optional[str] = None):
        self.model = model
        self.directory = Path(directory) if directory else Path(settings.data.registry_path).parent / subdir

    def _path(self, dataset_id: str) -> Path:
        return self.directory / f"{dataset_id}.json"

    def load(self, dataset: Dataset) -> Optional[T]:
        path = self._path(dataset.id)
        if not path.exists():
            return None
        try:
            entry = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as e:
            logger.warning(f"Could not read {path}: {e}")
            return None
        if entry.get("fingerprint") != dataset_fingerprint(dataset):
            return None
        return self.model(**entry["profile"])

    def save(self, dataset: Dataset, item: T) -> None:
        entry = {"fingerprint": dataset_fingerprint(dataset), "profile": item.model_dump(mode="json")}
        try:
            self.directory.mkdir(parents=True, exist_ok=True)
            path = self._path(dataset.id)
            tmp = path.with_suffix(".tmp")
            tmp.write_text(json.dumps(entry), encoding="utf-8")
            os.replace(tmp, path)
        except OSError as e:
            logger.warning(f"Could not save {self.directory.name} for {dataset.id}: {e}")

    def delete(self, dataset_id: str) -> None:
        try:
            self._path(dataset_id).unlink(missing_ok=True)
        except OSError as e:
            logger.warning(f"Could not delete {self.directory.name} for {dataset_id}: {e}")


profile_store: FingerprintStore[DatasetProfile] = FingerprintStore("profiles", DatasetProfile)
insights_store: FingerprintStore[AIInsights] = FingerprintStore("insights", AIInsights)
