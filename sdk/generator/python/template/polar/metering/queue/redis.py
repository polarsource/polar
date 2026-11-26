import collections.abc
import contextlib
import dataclasses
import datetime
import json
import math
import time
import typing
import uuid

import anyio
from redis.asyncio import Redis
from redis.commands.core import AsyncScript
from redis.exceptions import RedisError
from redis.exceptions import ResponseError as RedisResponseError
from redis.typing import StreamIdT

from polar._redis import (
    back_off,
    connect_redis,
    release_lock,
    take_lock,
)
from polar.logging import get_logger
from polar.metering.errors import (
    MeteringTimeoutError,
    IngestRejectedError,
    IngestRetryableError,
    validate_timeout,
)
from polar.metering.events import EventInput
from polar.metering.queue import Ingest, OnAck, OnRejected

log = get_logger(__name__)

QUEUE_BATCH = {{ redis_constants.queue_batch }}
FLUSHERS = {{ redis_constants.queue_flushers }}
QUEUE_CLAIM_IDLE = {{ redis_constants.queue_claim_idle / 1000 }}
FLUSHER_LOCK_TTL = {{ redis_constants.queue_flusher_lock_ttl / 1000 }}
FLUSH_TENURE = {{ redis_constants.queue_flush_tenure / 1000 }}
DRAIN_INTERVAL = {{ redis_constants.queue_drain_interval / 1000 }}
QUEUE_RETRY_DELAY = {{ redis_constants.queue_retry_delay / 1000 }}
MAX_QUEUE_RETRY_DELAY = {{ redis_constants.queue_max_retry_delay / 1000 }}
QUEUE_GROUP = "polar"

QUEUE_BACKLOG_SCRIPT = """
{{ redis_scripts.queue.queue_backlog }}"""

ACKNOWLEDGE_SCRIPT = """
{{ redis_scripts.queue.acknowledge }}"""

# NaN and the infinities are not JSON: no flusher could send an event that holds one.
_encode_event = json.JSONEncoder(allow_nan=False).encode


def _not_json(constant: str) -> typing.NoReturn:
    raise ValueError(f"{constant} is not JSON")


def _finite(number: str) -> float:
    value = float(number)
    return value if math.isfinite(value) else _not_json(number)


# How many times a batch goes again without the events Polar named, before it is dropped
# whole.
REFUSED_RESENDS = 3


@dataclasses.dataclass
class _Delivery:
    """The queue entries a flusher delivered, and the slot it holds."""

    entries: list[str | bytes]
    lock_key: str
    token: str


class RedisEventQueue:
    """Deliver events from a Redis stream shared by workers using the same Polar account.

    A supplied Redis client remains caller-owned. Use a distinct stream per Polar
    environment and organization. Delivery hooks can be
    called again if a worker fails before acknowledging the stream entries.
    """

    def __init__(
        self,
        redis: str | Redis,
        *,
        stream: str,
    ) -> None:
        self._redis_source = redis
        self._stream = stream
        self._backoff_key = f"{stream}:backoff"
        self._ingest: Ingest | None = None
        self._opening = False
        self._on_ack: OnAck | None = None
        self._on_rejected: OnRejected | None = None
        self._redis: Redis | None = None
        self._tasks: anyio.abc.TaskGroup | None = None
        self._queue_backlog: AsyncScript | None = None
        self._acknowledge: AsyncScript | None = None
        self._draining: anyio.Event | None = None
        self._drain_until = math.inf
        self._drain_again = False
        self._undrained = False

    @property
    def redis_url(self) -> str | None:
        return self._redis_source if isinstance(self._redis_source, str) else None

    def open(
        self,
        *,
        ingest: Ingest,
        on_ack: OnAck | None = None,
        on_rejected: OnRejected | None = None,
    ) -> contextlib.AbstractAsyncContextManager[typing.Self]:
        return self._open(self._redis_source, ingest=ingest, on_ack=on_ack, on_rejected=on_rejected)

    async def enqueue(self, event: EventInput) -> None:
        """Persist an event with a stable ID and timestamp for delivery retries."""
        await self._enqueue_encoded(
            _encode_event(
                {
                    **event,
                    "external_id": event.get("external_id") or uuid.uuid4().hex,
                    "timestamp": event.get("timestamp")
                    or datetime.datetime.now(datetime.UTC).isoformat(),
                }
            )
        )

    async def flush(self, *, timeout: float = 30.0) -> None:
        """Deliver this instance's events, or wait for its drain in flight: never for
        the rest of the fleet's stream."""
        validate_timeout(timeout)
        self._require_redis()
        with anyio.move_on_after(timeout) as scope:
            await self._drain_queue_quietly(limited=True)
        if scope.cancelled_caught:
            raise MeteringTimeoutError(timeout)

    @contextlib.asynccontextmanager
    async def _open(
        self,
        redis_source: str | Redis,
        *,
        ingest: Ingest,
        on_ack: OnAck | None = None,
        on_rejected: OnRejected | None = None,
    ) -> collections.abc.AsyncGenerator[typing.Self, None]:
        if self._opening:
            raise RuntimeError("Redis queue is already running")
        self._opening = True
        try:
            connection = (
                connect_redis(redis_source)
                if isinstance(redis_source, str)
                else contextlib.nullcontext(redis_source)
            )
            async with connection as redis:
                await self._create_queue_group(redis)
                self._queue_backlog = redis.register_script(QUEUE_BACKLOG_SCRIPT)
                self._acknowledge = redis.register_script(ACKNOWLEDGE_SCRIPT)
                async with anyio.create_task_group() as tasks:
                    self._redis = redis
                    self._tasks = tasks
                    self._ingest = ingest
                    self._on_ack = on_ack
                    self._on_rejected = on_rejected
                    tasks.start_soon(self._drain_on_time)
                    try:
                        yield self
                    finally:
                        try:
                            with anyio.move_on_after(30):
                                await self._drain_queue_quietly(limited=True)
                        finally:
                            tasks.cancel_scope.cancel()
        finally:
            self._redis = None
            self._tasks = None
            self._ingest = None
            self._on_ack = None
            self._on_rejected = None
            self._opening = False

    def _require_redis(self) -> Redis:
        if self._redis is None:
            raise RuntimeError("Use RedisEventQueue inside an open() context")
        return self._redis

    async def _enqueue_encoded(self, event: str) -> None:
        await self._require_redis().xadd(self._stream, {"event": event})
        self._undrained = True

    async def _create_queue_group(self, redis: Redis) -> None:
        """A flusher reads the queue through the group, which tracks each batch until
        Polar has it."""
        try:
            await redis.xgroup_create(
                self._stream, QUEUE_GROUP, id="0", mkstream=True
            )
        except RedisResponseError as error:
            if "BUSYGROUP" not in str(error):
                raise

    async def _drain_queue_quietly(self, *, limited: bool = False) -> None:
        """Redis keeps what a drain fails to deliver: the next flush takes it. Without an
        event of its own to deliver, a flush waits for the drain in flight, if any."""
        if self._redis is None:
            return
        if limited and (self._undrained or self._draining is not None):
            self._limit_drain()
        if self._undrained:
            await self._drain()
        elif self._draining is not None:
            await self._draining.wait()

    async def _drain(self) -> None:
        """One drain at a time per instance: a flush during one waits for it, and asks
        for one more round so that its own events do not stay queued. The drain runs in
        the instance's task group: a newer flush that releases an older one does not cut
        it short in the middle of a batch."""
        self._drain_again = True
        draining = self._draining
        if draining is None:
            assert self._tasks is not None
            draining = self._draining = anyio.Event()
            self._tasks.start_soon(self._run_drains, draining)
        await draining.wait()

    async def _run_drains(self, done: anyio.Event) -> None:
        try:
            while self._drain_again:
                self._drain_again = False
                self._undrained = False
                await self._drain_queue()
        # Whatever a drain raises, it must not end the task group, and with it the
        # task that started the queue.
        except* Exception:
            self._undrained = True
            log.exception("Redis queue drain failed")
        finally:
            self._draining = None
            self._drain_until = math.inf
            done.set()

    def _limit_drain(self) -> None:
        self._drain_until = min(self._drain_until, anyio.current_time() + FLUSH_TENURE)

    async def _drain_on_time(self) -> None:
        while True:
            await anyio.sleep(DRAIN_INTERVAL)
            await self._drain()

    async def _drain_queue(self) -> None:
        """One flusher per QUEUE_BATCH events waiting, up to FLUSHERS across the fleet.
        Once its flushers let go of their slots, the instance looks again: an event
        queued while they held them is not left behind."""
        redis = self._require_redis()
        assert self._queue_backlog is not None
        first = True
        # The backoff a round delivered past: the next round's read ends it.
        ended: list[bytes] = []
        try:
            while True:
                if anyio.current_time() >= self._drain_until:
                    self._undrained = True
                    return
                length, delivering, retry_at = await self._queue_backlog(
                    keys=[self._stream, self._backoff_key],
                    args=[QUEUE_GROUP, *ended],
                )
                # The first round also takes back the batches that wait on a failed or
                # frozen flusher.
                if not length or (not first and length == delivering):
                    return
                # Polar failed to take a batch: the fleet waits before sending the
                # queue again.
                if retry_at and float(retry_at) > time.time() * 1000:
                    self._undrained = True
                    return
                # A partial batch goes only when no flusher delivers: the last one in
                # flight takes it.
                full = (length - delivering) // QUEUE_BATCH
                slots = min(FLUSHERS, full or (0 if delivering and not first else 1))
                if not slots:
                    return
                first = False
                outcomes: list[str] = []

                async def flush_slot(slot: int, outcomes: list[str] = outcomes) -> None:
                    outcomes.append(await self._flush_slot(slot))

                async with anyio.create_task_group() as group:
                    for slot in range(slots):
                        group.start_soon(flush_slot, slot)
                if "failed" in outcomes:
                    self._undrained = True
                    return
                if "drained" not in outcomes:
                    return
                # Polar takes batches again: the next failure waits the first delay.
                ended = [retry_at] if retry_at else []
        except Exception as error:
            # Redis lost the group, with the rest of its keys: the next flush reads a new
            # one.
            errors = error.exceptions if isinstance(error, ExceptionGroup) else (error,)
            if any("NOGROUP" in str(each) for each in errors):
                await self._create_queue_group(redis)
            raise

    async def _flush_slot(self, slot: int) -> str:
        """A batch whose flusher froze is taken back once idle long enough; one this slot
        left behind, as Polar failed, goes before the new events."""
        redis = self._require_redis()
        lock_key = f"{self._stream}:flusher:{slot}"
        consumer = f"flusher-{slot}"
        token = await take_lock(redis, lock_key, FLUSHER_LOCK_TTL)
        if token is None:
            return "busy"
        try:
            if slot == 0:
                await redis.xautoclaim(
                    self._stream,
                    QUEUE_GROUP,
                    consumer,
                    int(QUEUE_CLAIM_IDLE * 1000),
                    count=QUEUE_BATCH,
                    justid=True,
                )
            start = "0"
            while True:
                if start == ">":
                    if anyio.current_time() >= self._drain_until:
                        self._undrained = True
                        return "drained"
                    assert self._queue_backlog is not None
                    length, delivering, _ = await self._queue_backlog(
                        keys=[self._stream, self._backoff_key],
                        args=[QUEUE_GROUP],
                    )
                    if length == delivering:
                        return "drained"
                    # The flusher still in flight takes a partial batch; if it let go
                    # meanwhile, the next drain does.
                    if delivering and length - delivering < QUEUE_BATCH:
                        self._undrained = True
                        return "drained"
                read = typing.cast(
                    list[typing.Any],
                    await redis.xreadgroup(
                        QUEUE_GROUP,
                        consumer,
                        {self._stream: start},
                        count=QUEUE_BATCH,
                    ),
                )
                entries = read[0][1] if read else []
                if entries:
                    delivery = _Delivery(
                        [entry for entry, _ in entries], lock_key, token
                    )
                    if not await self._deliver(entries, delivery):
                        # Slot 0 starts every drain and sends what it holds first: the
                        # batch goes to it, and does not wait for a drain large enough
                        # to start this slot again.
                        if slot:
                            ids: list[StreamIdT] = [*delivery.entries]
                            with contextlib.suppress(RedisError):
                                await redis.xclaim(
                                    self._stream,
                                    QUEUE_GROUP,
                                    "flusher-0",
                                    0,
                                    ids,
                                    justid=True,
                                )
                        return "failed"
                elif start == "0":
                    start = ">"
        finally:
            await release_lock(redis, lock_key, token)

    async def _back_off_queue(self, wait: float | None) -> None:
        """As long as Polar asks, or longer after each failure in a row."""
        await back_off(
            self._require_redis(),
            self._backoff_key,
            first=wait if wait is not None else QUEUE_RETRY_DELAY,
            maximum=wait if wait is not None else MAX_QUEUE_RETRY_DELAY,
        )

    async def _deliver(
        self, entries: list[typing.Any], delivery: _Delivery
    ) -> bool:
        events: list[EventInput] = []
        for _, fields in entries:
            if not fields:
                continue
            try:
                events.append(
                    json.loads(
                        fields.get("event") or fields.get(b"event", b""),
                        parse_constant=_not_json,
                        parse_float=_finite,
                    )
                )
            except ValueError:
                # It can never be sent: it leaves the queue with the batch.
                log.warning("Redis queue dropped an unreadable entry")
        refused: list[EventInput] = []
        resent = 0
        ingest = self._ingest
        assert ingest is not None
        while events:
            try:
                await ingest(events)
            except IngestRetryableError as error:
                await self._back_off_queue(error.retry_after)
                return False
            except IngestRejectedError as error:
                named = error.rejected_indexes
                if named and len(named) < len(events) and resent < REFUSED_RESENDS:
                    resent += 1
                    refused += [event for index, event in enumerate(events) if index in named]
                    events = [event for index, event in enumerate(events) if index not in named]
                    continue
                refused += events
                events = []
            break
        if refused and self._on_rejected is not None:
            await self._on_rejected(refused, "permanent_error")
        if events and self._on_ack is not None:
            await self._on_ack(events)
        assert self._acknowledge is not None
        await self._acknowledge(
            keys=[self._stream, delivery.lock_key],
            args=[
                QUEUE_GROUP,
                delivery.token,
                int(FLUSHER_LOCK_TTL * 1000),
                *delivery.entries,
            ],
        )
        return True
