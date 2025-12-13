import resource
import traceback
from typing import Any

import dramatiq
import logfire
import structlog

log = structlog.get_logger()


class MemoryMonitorMiddleware(dramatiq.Middleware):
    def __init__(self, hard_limit_mb: int = 3500) -> None:
        self.hard_limit_mb = hard_limit_mb

    def before_worker_boot(
        self, broker: dramatiq.Broker, worker: dramatiq.Worker
    ) -> None:
        soft_bytes = self.hard_limit_mb * 1024 * 1024
        hard_bytes = soft_bytes + (512 * 1024 * 1024)
        resource.setrlimit(resource.RLIMIT_AS, (soft_bytes, hard_bytes))
        log.info(
            "memory_limit_set",
            soft_mb=self.hard_limit_mb,
            hard_mb=hard_bytes // (1024 * 1024),
        )

    def after_process_message(
        self,
        broker: dramatiq.Broker,
        message: dramatiq.Message[Any],
        *,
        result: Any | None = None,
        exception: Exception | None = None,
    ) -> None:
        if isinstance(exception, MemoryError):
            log.error(
                "memory_limit_exceeded",
                actor=message.actor_name,
                message_id=message.message_id,
                args=message.args,
                kwargs=message.kwargs,
                stacktrace=traceback.format_exc(),
            )
            logfire.force_flush()
