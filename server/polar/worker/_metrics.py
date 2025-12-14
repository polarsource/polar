import glob
import os
import shutil
import time
from typing import Any

import dramatiq
import structlog

from polar.config import settings
from polar.observability import TASK_DURATION, TASK_EXECUTIONS, TASK_RETRIES
from polar.observability.remote_write import start_remote_write_pusher

log = structlog.get_logger()


class PrometheusMiddleware(dramatiq.Middleware):
    def before_worker_boot(
        self, broker: dramatiq.Broker, worker: dramatiq.Worker
    ) -> None:
        prometheus_dir = settings.WORKER_PROMETHEUS_DIR
        if prometheus_dir.exists():
            log.info("clearing_prometheus_multiproc_dir", path=str(prometheus_dir))
            # Clean up stale .db files from crashed workers first
            for db_file in glob.glob(str(prometheus_dir / "*.db")):
                try:
                    os.remove(db_file)
                except OSError as e:
                    log.warning(
                        "failed_to_remove_prometheus_db_file",
                        file=db_file,
                        error=str(e),
                    )
            # Remove directory and recreate fresh
            shutil.rmtree(prometheus_dir, ignore_errors=True)

        prometheus_dir.mkdir(parents=True, exist_ok=True)
        start_remote_write_pusher()

    def before_process_message(
        self, broker: dramatiq.Broker, message: dramatiq.MessageProxy
    ) -> None:
        message.options["prometheus_start_time"] = time.perf_counter()

        retries = message.options.get("retries", 0)
        if retries > 0:
            TASK_RETRIES.labels(task_name=message.actor_name).inc()

    def after_process_message(
        self,
        broker: dramatiq.Broker,
        message: dramatiq.MessageProxy,
        *,
        result: Any | None = None,
        exception: BaseException | None = None,
    ) -> None:
        start_time: float | None = message.options.pop("prometheus_start_time", None)
        if start_time is not None:
            duration = time.perf_counter() - start_time
            TASK_DURATION.labels(task_name=message.actor_name).observe(duration)

        status = "failure" if exception else "success"
        TASK_EXECUTIONS.labels(task_name=message.actor_name, status=status).inc()

    def after_skip_message(
        self, broker: dramatiq.Broker, message: dramatiq.MessageProxy
    ) -> None:
        start_time: float | None = message.options.pop("prometheus_start_time", None)
        if start_time is not None:
            duration = time.perf_counter() - start_time
            TASK_DURATION.labels(task_name=message.actor_name).observe(duration)

        TASK_EXECUTIONS.labels(task_name=message.actor_name, status="skipped").inc()
