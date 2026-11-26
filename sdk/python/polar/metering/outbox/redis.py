import collections.abc
import contextlib
import dataclasses
import datetime
import json
import math
import time
import types
import typing
import uuid

import anyio
import httpx2
from redis.asyncio import Redis
from redis.commands.core import AsyncScript
from redis.exceptions import RedisError
from redis.exceptions import ResponseError as RedisResponseError
from redis.typing import StreamIdT

from polar._redis import (
    DEFAULT_TIMEOUT,
    back_off,
    connect_redis,
    release_lock,
    take_lock,
)
from polar.logging import get_logger
from polar.metering.client import PolarClient
from polar.metering.errors import (
    MeteringTimeoutError,
    retry_after_seconds,
    validate_timeout,
)
from polar.metering.events import EventInput
from polar.metering.outbox import OnAck, OnRejected

log = get_logger(__name__)

OUTBOX_BATCH = 1000
FLUSHERS = 32
OUTBOX_CLAIM_IDLE = 60.0
FLUSHER_LOCK_TTL = 30.0
FLUSH_TENURE = 5.0
DRAIN_INTERVAL = 1.0
OUTBOX_RETRY_DELAY = 1.0
MAX_OUTBOX_RETRY_DELAY = 60.0
OUTBOX_GROUP = "polar"

OUTBOX_BACKLOG_SCRIPT = """
-- The outbox's length, how many of its entries flushers hold, and when the fleet may send it
-- again after Polar failed: KEYS[1] is the outbox, KEYS[2] its backoff, ARGV[1] the consumer group.
-- ARGV[2], optional, is the retry the caller read before it delivered: Polar takes batches
-- again, so that backoff ends, unless a flusher failed since and set a later one.
if ARGV[2] and redis.call('HGET', KEYS[2], 'retry_at') == ARGV[2] then
    redis.call('DEL', KEYS[2])
end
local retry_at = redis.call('HGET', KEYS[2], 'retry_at') or ''
local length = redis.call('XLEN', KEYS[1])
if length == 0 then
    return {0, 0, retry_at}
end
return {length, redis.call('XPENDING', KEYS[1], ARGV[1])[1], retry_at}
"""

CONFIRM_SCRIPT = """
-- Settles groups of events, one per (state, bucket), and acknowledges the outbox entries that
-- carried them. KEYS[1] is the outbox, KEYS[2] the lock of the flusher that delivered them, then
-- each group's state and pending hash in turn. ARGV[1] is the hot-only flag, ARGV[2] and ARGV[3]
-- the lock's token and TTL, ARGV[4] the number of entries, then the entries; then each group
-- gives its bucket start, its number of ids and the ids.
local BATCH = 1000
-- An entry is the event's value, or nothing when it only counts.
local function value_of(entry)
    return entry ~= '' and tonumber(entry) or nil
end
local function settle(state, pending_key, start, ids)
    local bucket = 'bucket:' .. start .. ':'
    local pending = 'pending:' .. start .. ':'
    -- Polar received the events but no snapshot counts them yet: a cold bucket keeps them
    -- pending for the snapshot that will, a hot one counts them whole either way.
    if ARGV[1] == '1' then
        local cutoff = redis.call('HGET', state, 'cold_until')
        if cutoff and tonumber(start) < tonumber(cutoff) then
            return 0
        end
    end
    local gone, seen = {}, {}
    local removed, sum = 0, 0
    local current = redis.call('HMGET', state, pending .. 'min', pending .. 'max')
    local min, max = tonumber(current[1]), tonumber(current[2])
    local extremum = false
    for offset = 1, #ids, BATCH do
        local last = math.min(offset + BATCH - 1, #ids)
        local entries = redis.call('HMGET', pending_key, unpack(ids, offset, last))
        for i, entry in ipairs(entries) do
            local id = ids[offset + i - 1]
            if entry and not seen[id] then
                seen[id] = true
                table.insert(gone, id)
                removed = removed + 1
                local value = value_of(entry)
                if value then
                    sum = sum + value
                    if value == min or value == max then extremum = true end
                end
            end
        end
    end
    if removed == 0 then
        return 0
    end
    for offset = 1, #gone, BATCH do
        redis.call('HDEL', pending_key, unpack(gone, offset, math.min(offset + BATCH - 1, #gone)))
    end
    local count = tonumber(redis.call('HINCRBY', state, pending .. 'count', -removed))
    redis.call('HINCRBYFLOAT', state, pending .. 'sum', -sum)
    if count <= 0 then
        redis.call('HDEL', state, pending .. 'count', pending .. 'sum', pending .. 'min', pending .. 'max')
        local cutoff = redis.call('HGET', state, 'cold_until')
        -- Polar counts the whole bucket once it is cold: the local copy has nothing left to add.
        if cutoff and tonumber(start) < tonumber(cutoff) then
            redis.call('HDEL', state, bucket .. 'count', bucket .. 'sum', bucket .. 'min', bucket .. 'max')
        end
    elseif extremum then
        -- Extrema cannot be decremented: read them off the events still pending.
        min, max = nil, nil
        for _, entry in ipairs(redis.call('HVALS', pending_key)) do
            local value = value_of(entry)
            if value then
                if not min or value < min then min = value end
                if not max or value > max then max = value end
            end
        end
        for func, value in pairs({min = min, max = max}) do
            redis.call('HSET', state, pending .. func, tostring(value))
        end
        if not min then redis.call('HDEL', state, pending .. 'min') end
        if not max then redis.call('HDEL', state, pending .. 'max') end
    end
    redis.call('EXPIRE', state, 86400)
    return removed
end
local entries = tonumber(ARGV[4])
if entries > 0 then
    local ids = {}
    for i = 5, 4 + entries do table.insert(ids, ARGV[i]) end
    for offset = 1, #ids, BATCH do
        local batch = {unpack(ids, offset, math.min(offset + BATCH - 1, #ids))}
        redis.call('XACK', KEYS[1], 'polar', unpack(batch))
        redis.call('XDEL', KEYS[1], unpack(batch))
    end
    -- The flusher holds its slot through the next batch.
    if redis.call('GET', KEYS[2]) == ARGV[2] then
        redis.call('PEXPIRE', KEYS[2], ARGV[3])
    end
end
local removed, cursor = 0, 5 + entries
for group = 1, (#KEYS - 2) / 2 do
    local start, count = ARGV[cursor], tonumber(ARGV[cursor + 1])
    local ids = {}
    for i = cursor + 2, cursor + 1 + count do table.insert(ids, ARGV[i]) end
    removed = removed + settle(KEYS[2 * group + 1], KEYS[2 * group + 2], start, ids)
    cursor = cursor + 2 + count
end
return removed
"""

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


def _refused_indexes(response: httpx2.Response) -> set[int] | None:
    """The indexes of the events Polar's validation refuses, when each of its errors
    names one."""
    if response.status_code != 422:
        return None
    try:
        locations = [error["loc"] for error in response.json()["detail"]]
    except (ValueError, KeyError, TypeError):
        return None
    indexes: set[int] = set()
    for location in locations:
        if (
            not isinstance(location, list)
            or len(location) < 3
            or location[:2] != ["body", "events"]
            or not isinstance(location[2], int)
        ):
            return None
        indexes.add(location[2])
    return indexes


def _retry_after(response: httpx2.Response | None) -> float | None:
    """How long Polar asks to wait, which only a rate limit says."""
    if response is None or response.status_code != 429:
        return None
    retry_after = response.headers.get("Retry-After")
    if not retry_after or not retry_after.isdecimal():
        return None
    return retry_after_seconds(int(retry_after))


@dataclasses.dataclass
class _Delivery:
    """The outbox entries a flusher delivered, and the slot it holds."""

    entries: list[str]
    lock_key: str
    token: str


_Settle = collections.abc.Callable[
    [list[EventInput], list[EventInput], _Delivery], collections.abc.Awaitable[None]
]


class RedisOutbox:
    """Deliver events from a Redis stream shared by workers using the same Polar account.

    Use a distinct stream per Polar environment and organization. Delivery hooks can be
    called again if a worker fails before acknowledging the stream entries.
    """

    def __init__(
        self,
        redis_url: str,
        *,
        stream: str,
        client: httpx2.AsyncClient,
        on_ack: OnAck | None = None,
        on_rejected: OnRejected | None = None,
    ) -> None:
        self._redis_url = redis_url
        self._stream = stream
        self._backoff_key = f"{stream}:backoff"
        self._client = client
        self.on_ack = on_ack
        self.on_rejected = on_rejected
        self._settle: _Settle | None = None
        self._request_timeout = DEFAULT_TIMEOUT
        self._stack = contextlib.AsyncExitStack()
        self._redis: Redis | None = None
        self._tasks: anyio.abc.TaskGroup | None = None
        self._outbox_backlog: AsyncScript | None = None
        self._confirm_script: AsyncScript | None = None
        self._draining: anyio.Event | None = None
        self._drain_until = math.inf
        self._drain_again = False
        self._undrained = False

    @classmethod
    def create(
        cls,
        polar: PolarClient,
        redis_url: str,
        *,
        stream: str,
        on_ack: OnAck | None = None,
        on_rejected: OnRejected | None = None,
    ) -> typing.Self:
        return cls(
            redis_url,
            stream=stream,
            client=polar._client._client,
            on_ack=on_ack,
            on_rejected=on_rejected,
        )

    async def __aenter__(self) -> typing.Self:
        if self._redis is not None:
            raise RuntimeError("Redis outbox is already running")
        try:
            redis = await self._stack.enter_async_context(
                connect_redis(self._redis_url)
            )
            tasks = await self._stack.enter_async_context(anyio.create_task_group())
            await self._start(redis, tasks)
            tasks.start_soon(self._drain_on_time)
        except BaseException:
            await self._stack.aclose()
            self._redis = None
            self._tasks = None
            raise
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: types.TracebackType | None,
    ) -> None:
        try:
            with anyio.move_on_after(30):
                await self._drain_outbox_quietly(limited=True)
        finally:
            assert self._tasks is not None
            self._tasks.cancel_scope.cancel()
            try:
                await self._stack.__aexit__(exc_type, exc_val, exc_tb)
            finally:
                self._redis = None
                self._tasks = None

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
        """Wait until the queued events reach a terminal delivery outcome."""
        validate_timeout(timeout)
        redis = self._require_redis()
        with anyio.move_on_after(timeout) as scope:
            latest = await redis.xrevrange(self._stream, count=1)
            if not latest:
                return
            end = latest[0][0]
            assert end is not None
            while True:
                self._limit_drain()
                await self._drain()
                if not await redis.xrange(self._stream, max=end, count=1):
                    return
                await anyio.sleep(DRAIN_INTERVAL)
        if scope.cancelled_caught:
            raise MeteringTimeoutError(timeout)

    async def _start(
        self,
        redis: Redis,
        tasks: anyio.abc.TaskGroup,
        *,
        settle: _Settle | None = None,
        request_timeout: float = DEFAULT_TIMEOUT,
    ) -> None:
        self._redis = redis
        self._tasks = tasks
        self._settle = settle
        self._request_timeout = request_timeout
        await self._create_outbox_group()
        self._outbox_backlog = redis.register_script(OUTBOX_BACKLOG_SCRIPT)
        if settle is None:
            self._confirm_script = redis.register_script(CONFIRM_SCRIPT)

    def _require_redis(self) -> Redis:
        if self._redis is None:
            raise RuntimeError("Use RedisOutbox inside an async with block")
        return self._redis

    async def _enqueue_encoded(self, event: str) -> None:
        await self._require_redis().xadd(self._stream, {"event": event})
        self._mark_queued()

    def _mark_queued(self) -> None:
        self._undrained = True

    async def _create_outbox_group(self) -> None:
        """A flusher reads the outbox through the group, which tracks each batch until
        Polar has it."""
        try:
            await self._require_redis().xgroup_create(
                self._stream, OUTBOX_GROUP, id="0", mkstream=True
            )
        except RedisResponseError as error:
            if "BUSYGROUP" not in str(error):
                raise

    async def _drain_outbox_quietly(self, *, limited: bool = False) -> None:
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
                await self._drain_outbox()
        # Whatever a drain raises, it must not end the task group, and with it the
        # task that started Outpost.
        except* Exception:
            self._undrained = True
            log.exception("Redis outbox drain failed")
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

    async def _drain_outbox(self) -> None:
        """One flusher per OUTBOX_BATCH events waiting, up to FLUSHERS across the fleet.
        Once its flushers let go of their slots, the instance looks again: an event
        queued while they held them is not left behind."""
        self._require_redis()
        assert self._outbox_backlog is not None
        first = True
        # The backoff a round delivered past: the next round's read ends it.
        ended: list[bytes] = []
        try:
            while True:
                if anyio.current_time() >= self._drain_until:
                    self._undrained = True
                    return
                length, delivering, retry_at = await self._outbox_backlog(
                    keys=[self._stream, self._backoff_key],
                    args=[OUTBOX_GROUP, *ended],
                )
                # The first round also takes back the batches that wait on a failed or
                # frozen flusher.
                if not length or (not first and length == delivering):
                    return
                # Polar failed to take a batch: the fleet waits before sending the
                # outbox again.
                if retry_at and float(retry_at) > time.time() * 1000:
                    self._undrained = True
                    return
                # A partial batch goes only when no flusher delivers: the last one in
                # flight takes it.
                full = (length - delivering) // OUTBOX_BATCH
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
                await self._create_outbox_group()
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
                    OUTBOX_GROUP,
                    consumer,
                    int(OUTBOX_CLAIM_IDLE * 1000),
                    count=OUTBOX_BATCH,
                    justid=True,
                )
            start = "0"
            while True:
                if start == ">":
                    if anyio.current_time() >= self._drain_until:
                        self._undrained = True
                        return "drained"
                    assert self._outbox_backlog is not None
                    length, delivering, _ = await self._outbox_backlog(
                        keys=[self._stream, self._backoff_key],
                        args=[OUTBOX_GROUP],
                    )
                    if length == delivering:
                        return "drained"
                    # The flusher still in flight takes a partial batch; if it let go
                    # meanwhile, the next drain does.
                    if delivering and length - delivering < OUTBOX_BATCH:
                        self._undrained = True
                        return "drained"
                read = typing.cast(
                    list[typing.Any],
                    await redis.xreadgroup(
                        OUTBOX_GROUP,
                        consumer,
                        {self._stream: start},
                        count=OUTBOX_BATCH,
                    ),
                )
                entries = read[0][1] if read else []
                if entries:
                    delivery = _Delivery(
                        [entry.decode() for entry, _ in entries], lock_key, token
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
                                    OUTBOX_GROUP,
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

    async def _back_off_outbox(self, wait: float | None) -> None:
        """As long as Polar asks, or longer after each failure in a row."""
        await back_off(
            self._require_redis(),
            self._backoff_key,
            first=wait if wait is not None else OUTBOX_RETRY_DELAY,
            maximum=wait if wait is not None else MAX_OUTBOX_RETRY_DELAY,
        )

    async def _deliver(self, entries: list[typing.Any], delivery: _Delivery) -> bool:
        events: list[EventInput] = []
        for _, fields in entries:
            if not fields:
                continue
            try:
                events.append(
                    json.loads(
                        fields.get(b"event", b""),
                        parse_constant=_not_json,
                        parse_float=_finite,
                    )
                )
            except ValueError:
                # It can never be sent: it leaves the outbox with the batch.
                log.warning("Redis outbox dropped an outbox entry it cannot read")
        refused: list[EventInput] = []
        resent = 0
        while events:
            try:
                response = await self._client.post(
                    "/v1/events/ingest",
                    json={"events": events},
                    timeout=self._request_timeout,
                )
            except httpx2.TransportError:
                await self._back_off_outbox(None)
                return False
            # Only a 2xx means Polar has the batch.
            if response.is_success:
                break
            # Polar refuses a whole request for the events it names: the others go
            # again without them, a few times at most.
            named = _refused_indexes(response)
            if named and len(named) < len(events) and resent < REFUSED_RESENDS:
                resent += 1
                refused += [e for index, e in enumerate(events) if index in named]
                events = [e for index, e in enumerate(events) if index not in named]
                continue
            # Authentication failures, timeouts, and rate limits leave entries queued.
            if response.is_client_error and response.status_code not in (
                401,
                403,
                408,
                429,
            ):
                refused += events
                events = []
                break
            await self._back_off_outbox(_retry_after(response))
            return False
        if self._settle is not None:
            await self._settle(events, refused, delivery)
        else:
            if refused and self.on_rejected is not None:
                await self.on_rejected(refused, "permanent_error")
            if events and self.on_ack is not None:
                await self.on_ack(events)
            assert self._confirm_script is not None
            await self._confirm_script(
                keys=[self._stream, delivery.lock_key],
                args=[
                    "",
                    delivery.token,
                    int(FLUSHER_LOCK_TTL * 1000),
                    len(delivery.entries),
                    *delivery.entries,
                ],
            )
        return True
