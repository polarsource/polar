import os
import socket
import tempfile
import threading
import tracemalloc

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


def _take_and_upload_snapshot(bucket: str) -> None:
    snapshot = tracemalloc.take_snapshot()

    now = utc_now()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H-%M-%S")
    pid = os.getpid()

    key = (
        f"memory-profiles/"
        f"{date_str}-{_GIT_SHA}-{_INSTANCE_ID}/"
        f"{time_str}_pid{pid}.snapshot"
    )

    with tempfile.TemporaryDirectory() as tmpdir:
        path = os.path.join(tmpdir, "snapshot")
        snapshot.dump(path)
        with open(path, "rb") as f:
            data = f.read()

    s3_client.put_object(
        Bucket=bucket,
        Key=key,
        Body=data,
        ContentType="application/octet-stream",
    )

    current, peak = tracemalloc.get_traced_memory()
    log.info(
        "memory_profile_snapshot_uploaded",
        s3_key=key,
        current_mb=round(current / 1024 / 1024, 1),
        peak_mb=round(peak / 1024 / 1024, 1),
        size_bytes=len(data),
    )


def _run_profile_loop(
    bucket: str,
    interval: int,
    nframes: int,
    shutdown_event: threading.Event,
) -> None:
    tracemalloc.start(nframes)
    log.info("memory_profile_tracemalloc_started", nframes=nframes)

    try:
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
    finally:
        tracemalloc.stop()
        log.info("memory_profile_tracemalloc_stopped")


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
                settings.MEMORY_PROFILE_NFRAMES,
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
            nframes=settings.MEMORY_PROFILE_NFRAMES,
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
