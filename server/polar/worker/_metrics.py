import time
from typing import Any

import dramatiq

from polar.observability import TASK_DURATION, TASK_EXECUTIONS, TASK_RETRIES
from polar.observability.remote_write import start_remote_write_pusher


class PrometheusMiddleware(dramatiq.Middleware):
    def before_worker_boot(
        self, broker: dramatiq.Broker, worker: dramatiq.Worker
    ) -> None:
        # Note: We intentionally don't clear the prometheus multiproc directory here.
        # In production, each deploy is a fresh container image with no stale files.
        # Clearing here would break Counter metrics because they eagerly create .db
        # files during import (before this hook runs), and clearing would delete them.
        start_remote_write_pusher()

    def before_process_message(
        self, broker: dramatiq.Broker, message: dramatiq.MessageProxy
    ) -> None:
        message.options["prometheus_start_time"] = time.perf_counter()

        retries = message.options.get("retries", 0)
        if retries > 0:
            queue_name = message.queue_name or "default"
            TASK_RETRIES.labels(queue=queue_name, task_name=message.actor_name).inc()

    def after_process_message(
        self,
        broker: dramatiq.Broker,
        message: dramatiq.MessageProxy,
        *,
        result: Any | None = None,
        exception: BaseException | None = None,
    ) -> None:
        start_time: float | None = message.options.pop("prometheus_start_time", None)
        queue_name = message.queue_name or "default"
        if start_time is not None:
            duration = time.perf_counter() - start_time
            TASK_DURATION.labels(
                queue=queue_name, task_name=message.actor_name
            ).observe(duration)

        status = "failure" if exception else "success"
        TASK_EXECUTIONS.labels(
            queue=queue_name, task_name=message.actor_name, status=status
        ).inc()

    def after_skip_message(
        self, broker: dramatiq.Broker, message: dramatiq.MessageProxy
    ) -> None:
        start_time: float | None = message.options.pop("prometheus_start_time", None)
        queue_name = message.queue_name or "default"
        if start_time is not None:
            duration = time.perf_counter() - start_time
            TASK_DURATION.labels(
                queue=queue_name, task_name=message.actor_name
            ).observe(duration)

        TASK_EXECUTIONS.labels(
            queue=queue_name, task_name=message.actor_name, status="skipped"
        ).inc()
