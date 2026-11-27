import os
import time

from starlette.types import ASGIApp, Message, Receive, Scope, Send

SCHEDSTAT_PATH = "/proc/self/schedstat"
CGROUP_CPU_STAT_PATH = "/sys/fs/cgroup/cpu.stat"


def is_supported() -> bool:
    return os.path.exists(SCHEDSTAT_PATH) and os.path.exists(CGROUP_CPU_STAT_PATH)


def _schedstat_ns() -> tuple[int, int]:
    """Time the worker spent on a CPU and waiting for one."""
    with open(SCHEDSTAT_PATH) as f:
        on_cpu, run_delay, _ = f.read().split()
    return int(on_cpu), int(run_delay)


def _throttled_usec() -> int:
    with open(CGROUP_CPU_STAT_PATH) as f:
        for line in f:
            key, value = line.split()
            if key == "throttled_usec":
                return int(value)
    return 0


class CPUStarvationMiddleware:
    """Record on the request span how the worker spent the request's wall time:
    on a CPU, waiting for one, or idle in the event loop awaiting IO. Worker
    times cover every request running concurrently in the same process."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start_ns = time.perf_counter_ns()
        on_cpu_ns, run_delay_ns = _schedstat_ns()
        throttled_usec = _throttled_usec()

        async def send_wrapper(message: Message) -> None:
            # The request span ends once the last body chunk is sent
            if message["type"] == "http.response.body" and not message.get(
                "more_body", False
            ):
                root_span = scope.get("logfire.span")
                if root_span is not None and root_span.is_recording():
                    wall_ns = time.perf_counter_ns() - start_ns
                    end_on_cpu_ns, end_run_delay_ns = _schedstat_ns()
                    on_cpu_delta_ns = end_on_cpu_ns - on_cpu_ns
                    run_delay_delta_ns = end_run_delay_ns - run_delay_ns
                    root_span.set_attributes(
                        {
                            "cpu.on_cpu_ms": on_cpu_delta_ns / 1e6,
                            "cpu.run_delay_ms": run_delay_delta_ns / 1e6,
                            "cpu.idle_ms": max(
                                wall_ns - on_cpu_delta_ns - run_delay_delta_ns, 0
                            )
                            / 1e6,
                            "cpu.throttled_ms": (_throttled_usec() - throttled_usec)
                            / 1e3,
                        }
                    )
            await send(message)

        await self.app(scope, receive, send_wrapper)
