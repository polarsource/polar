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

HIGH_MB_USAGE = 50  # Log when a single task consumes more than this many mb


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


def get_current_memory_mb() -> float:
    """Get current memory usage in MB using maxrss."""
    usage = resource.getrusage(resource.RUSAGE_SELF)
    # On macOS, ru_maxrss is in bytes; on Linux, it's in KB
    if os.uname().sysname == "Darwin":
        return usage.ru_maxrss / (1024 * 1024)
    return usage.ru_maxrss / 1024


class MemoryMonitorMiddleware(dramatiq.Middleware):
    def __init__(self, hard_limit_mb: int | None = None) -> None:
        self.hard_limit_mb = (
            hard_limit_mb if hard_limit_mb is not None else get_memory_limit_mb()
        )
        self._memory_before: float = 0.0

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

    def before_process_message(
        self, broker: dramatiq.Broker, message: dramatiq.Message[Any]
    ) -> None:
        self._memory_before = get_current_memory_mb()

    def after_process_message(
        self,
        broker: dramatiq.Broker,
        message: dramatiq.Message[Any],
        *,
        result: Any | None = None,
        exception: Exception | None = None,
    ) -> None:
        memory_after = get_current_memory_mb()
        memory_delta = memory_after - self._memory_before

        if isinstance(exception, MemoryError):
            log.error(
                "memory_limit_exceeded",
                actor=message.actor_name,
                message_id=message.message_id,
                args=message.args,
                kwargs=message.kwargs,
                memory_before_mb=round(self._memory_before, 2),
                memory_after_mb=round(memory_after, 2),
                memory_delta_mb=round(memory_delta, 2),
                memory_limit_mb=self.hard_limit_mb,
                stacktrace=traceback.format_exc(),
            )
            logfire.force_flush()
            return

        if memory_delta > HIGH_MB_USAGE:
            log.warning(
                "memory_task_high_consumption",
                actor=message.actor_name,
                message_id=message.message_id,
                args=message.args,
                kwargs=message.kwargs,
                memory_before_mb=round(self._memory_before, 2),
                memory_after_mb=round(memory_after, 2),
                memory_delta_mb=round(memory_delta, 2),
            )
