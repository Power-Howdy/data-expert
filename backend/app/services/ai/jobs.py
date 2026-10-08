import logging
import threading
import uuid
from typing import Callable, Dict

from app.models.ai_schemas import JobStatus

logger = logging.getLogger(__name__)
MAX_JOBS = 100


class Job:
    def __init__(self):
        self.status = JobStatus(id=str(uuid.uuid4()))
        self.cancel_event = threading.Event()

    def progress(self, done: int, total: int, message: str = "") -> None:
        self.status.done, self.status.total = done, total
        if message:
            self.status.message = message

    def cancelled(self) -> bool:
        return self.cancel_event.is_set()


class JobManager:
    """Runs long AI work on background threads; the browser polls for progress."""

    def __init__(self):
        self._jobs: Dict[str, Job] = {}
        self._lock = threading.Lock()

    def start(self, work: Callable[[Job], None]) -> JobStatus:
        job = Job()
        with self._lock:
            self._jobs[job.status.id] = job
            while len(self._jobs) > MAX_JOBS:
                self._jobs.pop(next(iter(self._jobs)))
        threading.Thread(target=self._run, args=(job, work), daemon=True).start()
        return job.status.model_copy()

    def _run(self, job: Job, work: Callable[[Job], None]) -> None:
        try:
            work(job)
            job.status.status = "cancelled" if job.cancelled() else "done"
        except Exception as e:
            logger.warning(f"AI job {job.status.id} failed: {e}")
            job.status.status, job.status.error = "error", str(e)

    def get(self, job_id: str) -> JobStatus:
        with self._lock:
            job = self._jobs.get(job_id)
        if not job:
            raise KeyError(job_id)
        return job.status.model_copy()

    def cancel(self, job_id: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
        if job:
            job.cancel_event.set()


job_manager = JobManager()
