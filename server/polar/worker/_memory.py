import os
import resource
import tracemalloc
import traceback
from typing import Any

import dramatiq
import logfire
import structlog

from polar.config import settings

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


class MemoryLimitMiddleware(dramatiq.Middleware):
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


class MemoryTraceMiddleware(dramatiq.Middleware):
    def __init__(
        self,
        enabled: bool = settings.WORKER_TRACEMALLOC,
        frames: int = settings.WORKER_TRACEMALLOC_FRAMES,
        threshold: int = settings.WORKER_TRACEMALLOC_THRESHOLD,
    ) -> None:
        self.enabled = enabled
        self.frames = frames
        self.threshold = threshold
        self._before_message: tracemalloc.Snapshot | None = None

    def before_worker_boot(
        self, broker: dramatiq.Broker, worker: dramatiq.Worker
    ) -> None:
        if not self.enabled:
            return

        tracemalloc.start(self.frames)
        log.info(
            "memory_trace_enabled",
            frames=self.frames,
            threshold=self.threshold,
        )

    def before_process_message(
        self, broker: dramatiq.Broker, message: dramatiq.Message[Any]
    ) -> None:
        if not self.enabled:
            return

        self._before_message = tracemalloc.take_snapshot()

    def after_process_message(
        self,
        broker: dramatiq.Broker,
        message: dramatiq.Message[Any],
        *,
        result: Any | None = None,
        exception: Exception | None = None,
    ) -> None:
        if not (self.enabled and self._before_message):
            return

        after_message = tracemalloc.take_snapshot()

        stats = after_message.compare_to(self._before_message, "traceback")
        total_delta_bytes = sum(stat.size_diff for stat in stats)
        total_delta_mb = total_delta_bytes / (1024 * 1024)
        if total_delta_mb < self.threshold:
            return

        allocations = []
        for stat in stats[:10]:
            # Skip < 1MB allocations
            if stat.size_diff < 1024 * 1024:
                continue

            allocations.append({
                "memory_mb": round(stat.size_diff / (1024 * 1024), 2),
                "traceback": self._format_traceback(stat.traceback),
            })

        log.warning(
            "memory_task_high_consumption",
            actor=message.actor_name,
            message_id=message.message_id,
            args=message.args,
            kwargs=message.kwargs,
            memory_delta_mb=round(total_delta_mb, 2),
            top_allocators=allocations,
        )

    def _format_traceback(self, stack: tracemalloc.Traceback) -> str:
        return "\n".join([
            f"  {frame.filename}:{frame.lineno}"
            for frame in stack
        ])
