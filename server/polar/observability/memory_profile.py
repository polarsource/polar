import gc
import json
import os
import resource
import socket
import sys
import threading
from collections import Counter

import structlog

from polar.config import settings
from polar.integrations.aws.s3.client import client as s3_client
from polar.kit.utils import utc_now

log = structlog.get_logger()

_INSTANCE_ID = (
    os.environ.get("RENDER_INSTANCE_ID")
    or os.environ.get("HOSTNAME")
    or socket.gethostname()
)
_GIT_SHA = os.environ.get("RENDER_GIT_COMMIT", "unknown")[:8]

_profiler_thread: threading.Thread | None = None
_shutdown_event: threading.Event | None = None
_start_lock = threading.Lock()
_previous_counts: dict[str, int] | None = None


def _get_rss_bytes() -> int:
    try:
        with open("/proc/self/statm") as f:
            pages = int(f.read().split()[1])
            return pages * os.sysconf("SC_PAGE_SIZE")
    except (FileNotFoundError, OSError):
        rusage = resource.getrusage(resource.RUSAGE_SELF)
        if sys.platform == "darwin":
            return rusage.ru_maxrss
        return rusage.ru_maxrss * 1024


def _type_name(t: type) -> str:
    module = getattr(t, "__module__", "")
    name = t.__qualname__
    if module and module != "builtins":
        return f"{module}.{name}"
    return name


def _collect_snapshot() -> dict[str, object]:
    global _previous_counts

    objects = gc.get_objects()

    type_counts: Counter[type] = Counter()
    type_sizes: dict[type, int] = {}
    for obj in objects:
        t = type(obj)
        type_counts[t] += 1
        try:
            type_sizes[t] = type_sizes.get(t, 0) + sys.getsizeof(obj)
        except (TypeError, ValueError):
            pass

    named_counts = {_type_name(t): c for t, c in type_counts.items()}

    top_by_count = [
        {"type": _type_name(t), "count": c} for t, c in type_counts.most_common(50)
    ]

    size_entries: list[tuple[float, str]] = [
        (round(s / 1024 / 1024, 2), _type_name(t)) for t, s in type_sizes.items()
    ]
    size_entries.sort(key=lambda x: -x[0])
    top_by_size = [{"type": name, "size_mb": size} for size, name in size_entries[:50]]

    growth: list[dict[str, str | int]] = []
    if _previous_counts is not None:
        delta_entries: list[tuple[int, str]] = []
        all_types = set(named_counts) | set(_previous_counts)
        for type_name in all_types:
            delta = named_counts.get(type_name, 0) - _previous_counts.get(type_name, 0)
            if delta != 0:
                delta_entries.append((delta, type_name))
        delta_entries.sort(key=lambda x: -x[0])
        growth = [{"type": name, "delta": d} for d, name in delta_entries[:50]]

    _previous_counts = named_counts

    return {
        "timestamp": utc_now().isoformat(),
        "instance_id": _INSTANCE_ID,
        "git_sha": _GIT_SHA,
        "pid": os.getpid(),
        "rss_mb": round(_get_rss_bytes() / 1024 / 1024, 1),
        "total_gc_objects": len(objects),
        "gc_stats": gc.get_stats(),
        "top_by_count": top_by_count,
        "top_by_size_mb": top_by_size,
        "growth": growth,
    }


def _take_and_upload_snapshot(bucket: str) -> None:
    snapshot = _collect_snapshot()

    now = utc_now()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H-%M-%S")

    key = (
        f"memory-profiles/"
        f"{date_str}-{_GIT_SHA}-{_INSTANCE_ID}/"
        f"{time_str}_pid{snapshot['pid']}.json"
    )

    data = json.dumps(snapshot, indent=2, default=str).encode()

    s3_client.put_object(
        Bucket=bucket,
        Key=key,
        Body=data,
        ContentType="application/json",
    )

    log.info(
        "memory_profile_snapshot_uploaded",
        s3_key=key,
        rss_mb=snapshot["rss_mb"],
        total_gc_objects=snapshot["total_gc_objects"],
        size_bytes=len(data),
    )


def _run_profile_loop(
    bucket: str,
    interval: int,
    shutdown_event: threading.Event,
) -> None:
    while not shutdown_event.is_set():
        shutdown_event.wait(interval)
        if shutdown_event.is_set():
            break

        try:
            _take_and_upload_snapshot(bucket)
        except Exception as e:
            log.error(
                "memory_profile_snapshot_failed",
                error=str(e),
                error_type=type(e).__name__,
            )


def start_memory_profiler() -> bool:
    global _profiler_thread, _shutdown_event

    with _start_lock:
        if _profiler_thread is not None:
            return True

        if not settings.MEMORY_PROFILE_ENABLED:
            return False

        bucket = settings.MEMORY_PROFILE_S3_BUCKET_NAME
        if not bucket:
            log.warning(
                "memory_profile_disabled",
                reason="no S3 bucket configured",
            )
            return False

        _shutdown_event = threading.Event()
        _profiler_thread = threading.Thread(
            target=_run_profile_loop,
            args=(
                bucket,
                settings.MEMORY_PROFILE_INTERVAL,
                _shutdown_event,
            ),
            daemon=True,
            name="memory-profiler",
        )
        _profiler_thread.start()

        log.info(
            "memory_profile_started",
            bucket=bucket,
            interval=settings.MEMORY_PROFILE_INTERVAL,
            instance_id=_INSTANCE_ID,
            git_sha=_GIT_SHA,
        )
        return True


def stop_memory_profiler(timeout: float = 5.0) -> None:
    global _profiler_thread, _shutdown_event

    with _start_lock:
        if _profiler_thread is None or _shutdown_event is None:
            return

        log.info("memory_profile_stopping")
        _shutdown_event.set()
        thread = _profiler_thread

    thread.join(timeout=timeout)

    with _start_lock:
        if thread.is_alive():
            log.warning("memory_profile_stop_timeout")
        else:
            log.info("memory_profile_stopped")

        _profiler_thread = None
        _shutdown_event = None
