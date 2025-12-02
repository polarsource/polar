"""
Prometheus Remote Write client for pushing metrics to Prometheus or Grafana Cloud.

It has been implemented from sratch as there is no native library and 3rd parties are outdated.

Implements the Prometheus Remote Write protocol (v1):
https://prometheus.io/docs/specs/prw/remote_write_spec/
"""

import asyncio
import base64
import math
import struct
import threading
import time
from collections.abc import Generator

import httpx
import snappy
import structlog
from prometheus_client import CollectorRegistry, Metric, multiprocess
from prometheus_client.samples import Sample

from polar.config import settings
from polar.redis import Redis, create_redis
from polar.worker._queue_metrics import collect_queue_metrics

log = structlog.get_logger()

_pusher_thread: threading.Thread | None = None
_shutdown_event: threading.Event | None = None
_start_lock = threading.Lock()


def _encode_varint(value: int) -> bytes:
    if value < 0:
        raise ValueError(f"Cannot encode negative varint: {value}")

    bits = value & 0x7F
    value >>= 7
    result = b""
    while value:
        result += bytes([0x80 | bits])
        bits = value & 0x7F
        value >>= 7
    result += bytes([bits])
    return result


def _encode_string(field_number: int, value: str) -> bytes:
    encoded = value.encode("utf-8")
    return bytes([field_number << 3 | 2]) + _encode_varint(len(encoded)) + encoded


def _encode_double(field_number: int, value: float) -> bytes:
    return bytes([field_number << 3 | 1]) + struct.pack("<d", value)


def _encode_int64(field_number: int, value: int) -> bytes:
    return bytes([field_number << 3 | 0]) + _encode_varint(value)


def _encode_label(name: str, value: str) -> bytes:
    return _encode_string(1, name) + _encode_string(2, value)


def _encode_sample(value: float, timestamp_ms: int) -> bytes:
    if not math.isfinite(value):
        value = 0.0
    return _encode_double(1, value) + _encode_int64(2, timestamp_ms)


def _encode_embedded(field_number: int, data: bytes) -> bytes:
    return bytes([field_number << 3 | 2]) + _encode_varint(len(data)) + data


def _encode_timeseries(
    labels: list[tuple[str, str]], value: float, timestamp_ms: int
) -> bytes:
    result = b""
    for name, val in labels:
        label_bytes = _encode_label(name, val)
        result += _encode_embedded(1, label_bytes)

    sample_bytes = _encode_sample(value, timestamp_ms)
    result += _encode_embedded(2, sample_bytes)

    return result


def _encode_write_request(timeseries_list: list[bytes]) -> bytes:
    result = b""
    for ts in timeseries_list:
        result += _encode_embedded(1, ts)
    return result


def _collect_metrics() -> Generator[tuple[list[tuple[str, str]], float], None, None]:
    registry = CollectorRegistry()
    multiprocess.MultiProcessCollector(registry)

    env_label = settings.ENV.value if settings.ENV else "unknown"

    metric: Metric
    for metric in registry.collect():
        sample: Sample
        for sample in metric.samples:
            labels = [("__name__", sample.name), ("env", env_label)]
            labels.extend(sample.labels.items())
            yield labels, sample.value


def _push_metrics(client: httpx.Client, url: str, headers: dict[str, str]) -> None:
    timestamp_ms = int(time.time() * 1000)

    timeseries_list: list[bytes] = []
    for labels, value in _collect_metrics():
        ts = _encode_timeseries(labels, value, timestamp_ms)
        timeseries_list.append(ts)

    if not timeseries_list:
        return

    write_request = _encode_write_request(timeseries_list)
    compressed = snappy.compress(write_request)

    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = client.post(
                url,
                content=compressed,
                headers={
                    **headers,
                    "Content-Type": "application/x-protobuf",
                    "Content-Encoding": "snappy",
                    "X-Prometheus-Remote-Write-Version": "0.1.0",
                },
            )

            if response.status_code in (200, 204):
                return

            if response.status_code >= 500 and attempt < max_retries - 1:
                log.warning(
                    "prometheus_remote_write_retry",
                    status_code=response.status_code,
                    attempt=attempt + 1,
                )
                time.sleep(min(2**attempt, 10))
                continue

            log.warning(
                "prometheus_remote_write_failed",
                status_code=response.status_code,
                response=response.text[:200],
            )
            return

        except (httpx.TimeoutException, httpx.NetworkError) as e:
            if attempt < max_retries - 1:
                log.warning(
                    "prometheus_remote_write_retry",
                    error=str(e),
                    attempt=attempt + 1,
                )
                time.sleep(min(2**attempt, 10))
                continue
            log.error("prometheus_remote_write_network_error", error=str(e))


async def _update_queue_metrics(redis: Redis) -> None:
    max_retries = 3
    for attempt in range(max_retries):
        try:
            await collect_queue_metrics(redis)
            return
        except Exception as e:
            if attempt < max_retries - 1:
                wait_time = min(2**attempt, 10)
                log.warning(
                    "queue_metrics_retry",
                    error=str(e),
                    attempt=attempt + 1,
                    wait_time=wait_time,
                )
                await asyncio.sleep(wait_time)
            else:
                log.warning(
                    "failed_to_collect_queue_metrics",
                    error=str(e),
                    attempts=max_retries,
                )


def _run_push_loop(
    url: str,
    username: str | None,
    password: str | None,
    interval: int,
    shutdown_event: threading.Event,
) -> None:
    headers: dict[str, str] = {}
    if username and password:
        credentials = base64.b64encode(f"{username}:{password}".encode()).decode()
        headers["Authorization"] = f"Basic {credentials}"

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    redis = create_redis("worker")
    try:
        with httpx.Client(timeout=httpx.Timeout(30.0, connect=5.0)) as client:
            while not shutdown_event.is_set():
                start_time = time.monotonic()
                try:
                    loop.run_until_complete(_update_queue_metrics(redis))
                    _push_metrics(client, url, headers)
                except Exception as e:
                    log.error(
                        "prometheus_remote_write_error",
                        error=str(e),
                        error_type=type(e).__name__,
                        exc_info=True,
                    )

                elapsed = time.monotonic() - start_time
                sleep_time = max(0, interval - elapsed)
                if sleep_time > 0:
                    shutdown_event.wait(sleep_time)
    finally:
        loop.run_until_complete(redis.close())
        loop.close()


def start_remote_write_pusher() -> bool:
    global _pusher_thread, _shutdown_event

    with _start_lock:
        if _pusher_thread is not None:
            return True

        url = settings.PROMETHEUS_REMOTE_WRITE_URL
        if not url:
            log.info("prometheus_remote_write_disabled", reason="no URL configured")
            return False

        if settings.PROMETHEUS_REMOTE_WRITE_INTERVAL <= 0:
            log.error(
                "prometheus_remote_write_invalid_config",
                reason="interval must be positive",
            )
            return False

        _shutdown_event = threading.Event()
        _pusher_thread = threading.Thread(
            target=_run_push_loop,
            args=(
                url,
                settings.PROMETHEUS_REMOTE_WRITE_USERNAME,
                settings.PROMETHEUS_REMOTE_WRITE_PASSWORD,
                settings.PROMETHEUS_REMOTE_WRITE_INTERVAL,
                _shutdown_event,
            ),
            daemon=True,
            name="prometheus-remote-write",
        )
        _pusher_thread.start()

        log.info(
            "prometheus_remote_write_started",
            url=url,
            interval=settings.PROMETHEUS_REMOTE_WRITE_INTERVAL,
        )
        return True


def stop_remote_write_pusher(timeout: float = 5.0) -> None:
    global _pusher_thread, _shutdown_event

    with _start_lock:
        if _pusher_thread is None or _shutdown_event is None:
            return

        log.info("prometheus_remote_write_stopping")
        _shutdown_event.set()
        thread = _pusher_thread

    thread.join(timeout=timeout)

    with _start_lock:
        if thread.is_alive():
            log.warning("prometheus_remote_write_stop_timeout")
        else:
            log.info("prometheus_remote_write_stopped")

        _pusher_thread = None
        _shutdown_event = None
