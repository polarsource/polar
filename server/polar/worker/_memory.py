import os
import resource
import traceback
from typing import Any

import dramatiq
import logfire
import structlog

log = structlog.get_logger()

RENDER_CPU_TO_RAM_MB: dict[str, int] = {
    "0.1": 512,
    "0.5": 512,
    "1": 2048,
    "2": 4096,
    "4": 8192,  # Pro Plus (8GB) or Pro Max (16GB) - assume lower
    "8": 32768,
}


def get_memory_limit_mb() -> int:
    cpu_count = os.environ.get("RENDER_CPU_COUNT")
    if cpu_count is None:
        return 3500

    ram_mb = RENDER_CPU_TO_RAM_MB.get(cpu_count)
    if ram_mb is None:
        return 3500

    if ram_mb > 4096:
        return ram_mb - 300
    else:
        return ram_mb - 100


class MemoryMonitorMiddleware(dramatiq.Middleware):
    def __init__(self, hard_limit_mb: int | None = None) -> None:
        self.hard_limit_mb = (
            hard_limit_mb if hard_limit_mb is not None else get_memory_limit_mb()
        )

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
        message: dramatiq.MessageProxy,
        *,
        result: Any | None = None,
        exception: BaseException | None = None,
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
