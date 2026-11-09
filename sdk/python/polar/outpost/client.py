import collections
import collections.abc
import contextlib
import dataclasses
import datetime
import functools
import hashlib
import json
import math
import time
import types
import typing
import uuid

import anyio
import httpx
from opentelemetry import context as otel_context
from opentelemetry import trace
from opentelemetry.metrics import Counter, Histogram, _Gauge
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.trace import Span, StatusCode
from opentelemetry.util.types import AttributeValue
from redis.asyncio import Redis
from redis.asyncio.client import PubSub
from redis.asyncio.retry import Retry
from redis.backoff import EqualJitterBackoff, NoBackoff
from redis.commands.core import AsyncScript
from redis.exceptions import (
    AuthenticationError,
    AuthorizationError,
    NoScriptError,
    RedisError,
)
from redis.exceptions import ConnectionError as RedisConnectionError
from redis.exceptions import TimeoutError as RedisTimeoutError

from polar.base import PolarError
from polar.metering.client import PolarClient
from polar.metering.errors import UnknownMeterError
from polar.metering.events import EventInput
from polar.metering.meter import CustomerMeter
from polar.outpost.event import Event
from polar.outpost.reducer import (
    BUCKET_SIZE,
    BucketStatistics,
    Reducer,
    ReducerMatcher,
    get_bucket_start,
    reduce,
    with_matchers,
)
from polar.outpost.telemetry import (
    create_meter_provider,
    create_tracer_provider,
    is_telemetry_enabled,
)


class PolarOutpostError(PolarError): ...


# What Polar has not sent yet: a snapshot. A read that raises it is not ready.
class _NotReadyError(PolarOutpostError): ...


class UnavailableRedisError(PolarOutpostError):
    def __init__(self) -> None:
        super().__init__("Redis is unavailable")


class MissingExternalIdError(PolarOutpostError):
    def __init__(self) -> None:
        super().__init__("Outpost needs an external_id on every event")


def _number(value: str) -> int | float:
    if value.isdecimal() or (value[:1] == "-" and value[1:].isdecimal()):
        return int(value)
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("Stored aggregation values must be finite")
    return number


def _decode(value: str | bytes) -> str:
    return value.decode() if isinstance(value, bytes) else value


def _report_local_value(
    span: Span,
    snapshot: "Snapshot",
    replaced: collections.abc.Sequence[str | bytes],
    # The state before the transaction settled confirmed events out of the pending part.
    before: collections.abc.Mapping[str | bytes, str | bytes] | None = None,
) -> None:
    decoded = [_decode(value) for value in replaced]
    fields = dict(zip(decoded[::2], decoded[1::2], strict=True))
    if "cold_until" not in fields:
        return
    previous = int(fields["cold_until"])
    local = BucketStatistics()
    buckets: dict[str, BucketStatistics] = {}
    pending: dict[str, BucketStatistics] = {}
    source = (
        fields
        if before is None
        else {_decode(field): _decode(value) for field, value in before.items()}
    )
    for field, value in source.items():
        if field.startswith("cold:"):
            setattr(local, field.removeprefix("cold:"), _number(value))
            continue
        kind, _, rest = field.partition(":")
        if kind not in ("bucket", "pending"):
            continue
        start, _, statistic = rest.partition(":")
        if int(start) >= snapshot["cold_until"]:
            continue
        group = buckets if kind == "bucket" else pending
        setattr(group.setdefault(start, BucketStatistics()), statistic, _number(value))
    # A bucket already cold before this snapshot was read by its pending part only.
    for start, bucket in buckets.items():
        local.add(
            pending.get(start, BucketStatistics()) if int(start) < previous else bucket
        )
    span.set_attributes(
        {
            "outpost.local.cold_until": previous,
            "outpost.local.count": local.count,
            "outpost.local.sum": local.sum,
            "outpost.snapshot.count": snapshot["count"],
            "outpost.snapshot.sum": snapshot["sum"],
            "outpost.snapshot.delta": local.count != snapshot["count"]
            or not math.isclose(local.sum, snapshot["sum"])
            or local.min != snapshot["min"]
            or local.max != snapshot["max"],
        }
    )
    for statistic in ("min", "max"):
        if (value := getattr(local, statistic)) is not None:
            span.set_attribute(f"outpost.local.{statistic}", value)
        if (value := snapshot[statistic]) is not None:
            span.set_attribute(f"outpost.snapshot.{statistic}", value)


class RedisReconnectBackoff(EqualJitterBackoff):
    def __init__(self) -> None:
        super().__init__(cap=MAX_REDIS_RECONNECT_DELAY, base=REDIS_RECONNECT_DELAY)

    def compute(self, failures: int) -> float:
        # Bounded exponent: a long outage would overflow the float otherwise.
        return super().compute(min(failures, 16))


_P = typing.ParamSpec("_P")
_R = typing.TypeVar("_R")


def _raise_redis_unavailable(
    method: collections.abc.Callable[_P, collections.abc.Awaitable[_R]],
) -> collections.abc.Callable[_P, collections.abc.Awaitable[_R]]:
    @functools.wraps(method)
    async def wrapper(*args: _P.args, **kwargs: _P.kwargs) -> _R:
        try:
            return await method(*args, **kwargs)
        except (RedisConnectionError, RedisTimeoutError) as error:
            raise UnavailableRedisError() from error

    return wrapper


@dataclasses.dataclass
class _Read:
    outcome: str = "not_ready"


def _is_connection_error(error: BaseException) -> bool:
    if isinstance(error, BaseExceptionGroup):
        return all(_is_connection_error(inner) for inner in error.exceptions)
    if isinstance(error, (AuthenticationError, AuthorizationError)):
        return False
    return isinstance(
        error,
        (
            httpx.HTTPError,
            OSError,
            RedisConnectionError,
            RedisTimeoutError,
        ),
    )


def _generate_epoch() -> str:
    return uuid.uuid4().hex


@contextlib.asynccontextmanager
async def connect_redis(url: str) -> collections.abc.AsyncGenerator[Redis, None]:
    async with Redis.from_url(
        url,
        retry=Retry(NoBackoff(), 0),
        socket_timeout=TIMEOUT,
        socket_connect_timeout=TIMEOUT,
    ) as redis:
        await redis.ping()
        yield redis


# Shared by every Outpost SDK: sdk/generator/outpost/constants.toml says what each one
# means. Durations are in seconds here.
KEY_VERSION = "outpost:v1"
CACHE_SIZE = 1024
TIMEOUT = 5.0
SNAPSHOT_TIMEOUT = 5.0
CONFIRM_TIMEOUT = 2.0
CONFIRM_BATCH = 1000
SYNC_INTERVAL = 30.0
REDIS_RECONNECT_DELAY = 0.1
MAX_REDIS_RECONNECT_DELAY = 2.0
PULL_INTERVAL = 30.0
PULL_LOCK_TTL = 10.0
PULL_RETRY_DELAY = 1.0
MAX_PULL_RETRY_DELAY = 30.0
PULL_LIMIT = 500
PULL_CHECK_INTERVAL = 1.0
RELEASE_LOCK_SCRIPT = """
-- Deletes the lock, if it still holds this instance's token: once the lock expired, another
-- instance may hold it.
local lock = KEYS[1]
local token = ARGV[1]

if redis.call('GET', lock) == token then
    return redis.call('DEL', lock)
end
return 0
"""

EXTEND_LOCK_SCRIPT = """
-- Keeps the lock for another ttl milliseconds, if it still holds this instance's token.
local lock = KEYS[1]
local token = ARGV[1]
local ttl = ARGV[2]

if redis.call('GET', lock) == token then
    return redis.call('PEXPIRE', lock, ttl)
end
return 0
"""

READ_STATE_SCRIPT = """
if not redis.call('HGET', KEYS[1], 'epoch') then
    redis.call('HSET', KEYS[1], 'epoch', ARGV[1], 'revision', '0')
end
redis.call('EXPIRE', KEYS[1], 86400)
return redis.call('HGETALL', KEYS[1])
"""

WRITE_BUCKET_SCRIPT = """
local bucket = 'bucket:' .. ARGV[4] .. ':'
local pending = 'pending:' .. ARGV[4] .. ':'
local fields = {'epoch', 'revision'}
for _, prefix in ipairs({bucket, pending}) do
    for _, statistic in ipairs({'count', 'sum', 'min', 'max'}) do
        table.insert(fields, prefix .. statistic)
    end
end
local function reply()
    local values = redis.call('HMGET', KEYS[1], unpack(fields))
    local update = {}
    for i, field in ipairs(fields) do
        if values[i] then
            table.insert(update, field)
            table.insert(update, values[i])
        end
    end
    return update
end
local total = tonumber(redis.call('HGET', KEYS[1], bucket .. 'sum') or '0') + tonumber(ARGV[6])
assert(total == total and math.abs(total) ~= math.huge, 'Aggregation values must be finite')
for i, func in ipairs({'min', 'max'}) do
    local raw = ARGV[6 + i]
    if raw ~= '' then
        local value = tonumber(raw)
        assert(value and value == value and math.abs(value) ~= math.huge, 'Invalid value')
    end
end
-- One event pending: its value, or nothing when it only counts. An external_id Polar has not
-- confirmed yet: tracking it again changes nothing.
assert(ARGV[5] == '1', 'One event per write')
local entry = ARGV[7] ~= '' and ARGV[6] or ''
if redis.call('HSETNX', KEYS[2], ARGV[9], entry) == 0 then
    return reply()
end
-- Every local event counts in its bucket; the pending part is what Polar has not confirmed.
for _, prefix in ipairs({bucket, pending}) do
    redis.call('HINCRBYFLOAT', KEYS[1], prefix .. 'sum', ARGV[6])
    redis.call('HINCRBY', KEYS[1], prefix .. 'count', ARGV[5])
    for i, func in ipairs({'min', 'max'}) do
        local raw = ARGV[6 + i]
        if raw ~= '' then
            local value = tonumber(raw)
            local stored = redis.call('HGET', KEYS[1], prefix .. func)
            local previous = stored and tonumber(stored)
            if not previous or (func == 'min' and value < previous)
                or (func == 'max' and value > previous) then
                redis.call('HSET', KEYS[1], prefix .. func, raw)
            end
        end
    end
end
-- Events nobody confirms are forgotten an hour after the last write to their bucket. A state
-- nobody reads, writes or snapshots for a day is forgotten too: the next read rebuilds it from
-- Polar's snapshot.
redis.call('EXPIRE', KEYS[2], 3900)

if not redis.call('HGET', KEYS[1], 'epoch') then
    redis.call('HSET', KEYS[1], 'epoch', ARGV[3], 'revision', '0')
end
redis.call('HINCRBY', KEYS[1], 'revision', 1)
redis.call('EXPIRE', KEYS[1], 86400)
local update = reply()
redis.call('PUBLISH', ARGV[2], cjson.encode({customer = ARGV[1], bucket = update}))
return update
"""

WRITE_BUCKET_SHA = hashlib.sha1(WRITE_BUCKET_SCRIPT.encode()).hexdigest()

CONFIRM_SCRIPT = """
local bucket = 'bucket:' .. ARGV[4] .. ':'
local pending = 'pending:' .. ARGV[4] .. ':'
local BATCH = 1000
-- Polar received the events but no snapshot counts them yet: a cold bucket keeps them
-- pending for the snapshot that will, a hot one counts them whole either way.
if ARGV[5] == '1' then
    local cutoff = redis.call('HGET', KEYS[1], 'cold_until')
    if cutoff and tonumber(ARGV[4]) < tonumber(cutoff) then
        return {}
    end
end
local ids = {}
for i = 6, #ARGV do table.insert(ids, ARGV[i]) end
local gone, seen = {}, {}
local removed, sum = 0, 0
local current = redis.call('HMGET', KEYS[1], pending .. 'min', pending .. 'max')
local min, max = tonumber(current[1]), tonumber(current[2])
local extremum = false
-- An entry is the event's value, or nothing when it only counts. Earlier SDK versions stored
-- the event's count, sum, min and max as a JSON array; their entries expire within the hour.
local function value_of(entry)
    if entry:sub(1, 1) == '[' then
        local legacy = cjson.decode(entry)
        entry = legacy[3] ~= '' and legacy[2] or ''
    end
    return entry ~= '' and tonumber(entry) or nil
end
for offset = 1, #ids, BATCH do
    local last = math.min(offset + BATCH - 1, #ids)
    local entries = redis.call('HMGET', KEYS[2], unpack(ids, offset, last))
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
    return {}
end
for offset = 1, #gone, BATCH do
    redis.call('HDEL', KEYS[2], unpack(gone, offset, math.min(offset + BATCH - 1, #gone)))
end
local count = tonumber(redis.call('HINCRBY', KEYS[1], pending .. 'count', -removed))
redis.call('HINCRBYFLOAT', KEYS[1], pending .. 'sum', -sum)
if count <= 0 then
    redis.call('HDEL', KEYS[1], pending .. 'count', pending .. 'sum', pending .. 'min', pending .. 'max')
    local cutoff = redis.call('HGET', KEYS[1], 'cold_until')
    -- Polar counts the whole bucket once it is cold: the local copy has nothing left to add.
    if cutoff and tonumber(ARGV[4]) < tonumber(cutoff) then
        redis.call('HDEL', KEYS[1], bucket .. 'count', bucket .. 'sum', bucket .. 'min', bucket .. 'max')
    end
elseif extremum then
    -- Extrema cannot be decremented: read them off the events still pending.
    min, max = nil, nil
    for _, entry in ipairs(redis.call('HVALS', KEYS[2])) do
        local value = value_of(entry)
        if value then
            if not min or value < min then min = value end
            if not max or value > max then max = value end
        end
    end
    for func, value in pairs({min = min, max = max}) do
        redis.call('HSET', KEYS[1], pending .. func, tostring(value))
    end
    if not min then redis.call('HDEL', KEYS[1], pending .. 'min') end
    if not max then redis.call('HDEL', KEYS[1], pending .. 'max') end
end

if not redis.call('HGET', KEYS[1], 'epoch') then
    redis.call('HSET', KEYS[1], 'epoch', ARGV[3], 'revision', '0')
end
redis.call('HINCRBY', KEYS[1], 'revision', 1)
redis.call('EXPIRE', KEYS[1], 86400)
-- A confirmation can drop a bucket, which a bucket update cannot express: send the whole state.
local state = redis.call('HGETALL', KEYS[1])
redis.call('PUBLISH', ARGV[2], cjson.encode({customer = ARGV[1], state = state}))
return state
"""

CONFIRM_SHA = hashlib.sha1(CONFIRM_SCRIPT.encode()).hexdigest()

APPLY_SNAPSHOT_SCRIPT = """
local cutoff = tonumber(ARGV[4])
local state = redis.call('HGETALL', KEYS[1])
local fields = {}
for i = 1, #state, 2 do fields[state[i]] = state[i + 1] end
local current = fields['cold_until']
local previous = fields['snapshot_version']
-- Polar sends each snapshot to every instance: an older one changes nothing.
if (current and tonumber(current) > cutoff)
    or (previous and tonumber(ARGV[5]) < tonumber(previous)) then
    return {state, {}}
end
local replaced = {}
if current then replaced = {'cold_until', current} end
-- Polar's totals now cover the buckets before the cutoff. The local copy of each is
-- reported with its pending part, and kept while events Polar has not confirmed remain
-- pending in it, for an hour at most: that pending part is what the local read adds on
-- top of Polar's totals.
local function sealed(start)
    local pending = fields['pending:' .. start .. ':count']
    return not pending or tonumber(pending) <= 0 or tonumber(start) + 3600000000 < cutoff
end
local dropped = {}
local seals = false
for field, value in pairs(fields) do
    if string.sub(field, 1, 5) == 'cold:' then
        table.insert(replaced, field)
        table.insert(replaced, value)
        table.insert(dropped, field)
    else
        local kind, start = string.match(field, '^(%a+):(%-?%d+):')
        if (kind == 'bucket' or kind == 'pending') and tonumber(start) < cutoff then
            table.insert(replaced, field)
            table.insert(replaced, value)
            if sealed(start) then
                table.insert(dropped, field)
                seals = true
            end
        end
    end
end
-- Numbers, not strings: SDKs in other languages may format the same value differently.
local function stored(field, value)
    if value == '' then return fields[field] == nil end
    return fields[field] ~= nil and tonumber(fields[field]) == tonumber(value)
end
-- The snapshot another instance applied: nothing to write, nobody to tell.
if not seals and stored('cold_until', ARGV[4]) and stored('cold:count', ARGV[6])
    and stored('cold:sum', ARGV[7]) and stored('cold:min', ARGV[8])
    and stored('cold:max', ARGV[9]) then
    redis.call('HSET', KEYS[1], 'snapshot_version', ARGV[5])
    redis.call('EXPIRE', KEYS[1], 86400)
    return {state, {}}
end
for i = 1, #dropped, 1000 do
    redis.call('HDEL', KEYS[1], unpack(dropped, i, math.min(i + 999, #dropped)))
end
redis.call('HSET', KEYS[1], 'cold_until', ARGV[4], 'snapshot_version', ARGV[5],
    'cold:count', ARGV[6], 'cold:sum', ARGV[7])
if ARGV[8] ~= '' then redis.call('HSET', KEYS[1], 'cold:min', ARGV[8]) end
if ARGV[9] ~= '' then redis.call('HSET', KEYS[1], 'cold:max', ARGV[9]) end
if not fields['epoch'] then
    redis.call('HSET', KEYS[1], 'epoch', ARGV[3], 'revision', '0')
end
redis.call('HINCRBY', KEYS[1], 'revision', 1)
redis.call('EXPIRE', KEYS[1], 86400)
state = redis.call('HGETALL', KEYS[1])
redis.call('PUBLISH', ARGV[2], cjson.encode({customer = ARGV[1], state = state}))
return {state, replaced}
"""

COMMIT_PULL_SCRIPT = """
-- Saves the cursor once a page of changes is applied. Returns 0 and saves nothing when this
-- instance no longer holds the pull lock: once the lock expired, another instance may pull.
local pull = KEYS[1]
local lock = KEYS[2]
local token = ARGV[1]
local cursor = ARGV[2]
local pulled_at = ARGV[3]
local next_poll_in = ARGV[4]
local channel = ARGV[5]
-- '1' on the last page: the pull is over and the lock goes.
local last_page = ARGV[6] == '1'

if redis.call('GET', lock) ~= token then
    return 0
end
redis.call('HSET', pull, 'cursor', cursor, 'pulled_at', pulled_at, 'next_poll_in', next_poll_in)
-- A pull that succeeds ends the backoff.
redis.call('HDEL', pull, 'failures', 'retry_at')
if last_page then
    redis.call('DEL', lock)
end
-- Every instance learns when the next pull is due.
redis.call('PUBLISH', channel,
    cjson.encode({pulled = {at = tonumber(pulled_at), next = tonumber(next_poll_in)}}))
return 1
"""

BACKOFF_SCRIPT = """
-- Counts one more failure in a row on a key the whole fleet shares, such as the pull's, and
-- says when to try again. Each failure in a row doubles the wait, up to a maximum.
local key = KEYS[1]
local now = tonumber(ARGV[1])
local first_delay = tonumber(ARGV[2])
local max_delay = tonumber(ARGV[3])
local channel = ARGV[4]
-- Optional: the key expires this many milliseconds later, and its failures with it.
local forget_after = ARGV[5]

local failures = redis.call('HINCRBY', key, 'failures', 1)
local delay = math.min(max_delay, first_delay * 2 ^ math.min(failures - 1, 16))
local retry_at = now + delay
redis.call('HSET', key, 'retry_at', retry_at)
if forget_after then
    redis.call('PEXPIRE', key, forget_after)
end
-- Every instance learns when it may try again.
redis.call('PUBLISH', channel, cjson.encode({failed = {key = key, retry = retry_at}}))
return retry_at
"""


# An instance pulled: when, and when the next pull is due, in milliseconds.
class _Pulled(typing.TypedDict):
    at: int
    next: int


# A pull failed, or Polar does not know a customer: nothing is tried again on the key before
# then, in milliseconds.
class _Failed(typing.TypedDict):
    key: str
    retry: int


class StateUpdate(typing.TypedDict):
    customer: typing.NotRequired[str]
    state: typing.NotRequired[list[str]]
    bucket: typing.NotRequired[list[str]]
    pulled: typing.NotRequired[_Pulled]
    failed: typing.NotRequired[_Failed]
    reset: typing.NotRequired[bool]


@dataclasses.dataclass
class ReducerState:
    epoch: str
    revision: int
    cold_until: int | None
    cold: BucketStatistics
    buckets: dict[int, BucketStatistics]
    # The part of each bucket Polar has not confirmed yet.
    pending: dict[int, BucketStatistics]


def decode_state(values: collections.abc.Sequence[str | bytes]) -> ReducerState:
    epoch = ""
    revision = 0
    cold_until: int | None = None
    cold = BucketStatistics()
    buckets: dict[int, BucketStatistics] = {}
    pending: dict[int, BucketStatistics] = {}
    # The statistics each `<group>:<statistic>` field writes to, by group: `cold` and every
    # `bucket:<start>` or `pending:<start>` seen so far.
    groups: dict[str, BucketStatistics] = {"cold": cold}
    # Fields and values alternate: zipping one iterator with itself reads them in pairs.
    pairs = iter(values)
    for field, value in zip(pairs, pairs, strict=True):
        if isinstance(field, bytes):
            field = field.decode()
        if isinstance(value, bytes):
            value = value.decode()
        group, separator, statistic = field.rpartition(":")
        bucket = groups.get(group)
        if bucket is None:
            if not separator:
                if field == "epoch":
                    epoch = value
                elif field == "revision":
                    revision = int(value)
                elif field == "cold_until":
                    cold_until = int(value)
                continue
            kind, _, timestamp = group.partition(":")
            if kind == "bucket" or kind == "pending":
                bucket = BucketStatistics()
                (buckets if kind == "bucket" else pending)[int(timestamp)] = bucket
                groups[group] = bucket
            else:
                continue
        setattr(bucket, statistic, int(value) if value.isdecimal() else _number(value))
    return ReducerState(
        epoch=epoch,
        revision=revision,
        cold_until=cold_until,
        cold=cold,
        buckets=buckets,
        pending=pending,
    )


# Polar's totals cover the cold buckets: the local read adds what Polar has not confirmed in
# them, and every local event in the buckets Polar has not sealed yet.
def consumed_units(state: ReducerState, func: str) -> int | float:
    cold_until = state.cold_until
    assert cold_until is not None
    cold = state.cold
    count, total, low, high = cold.count, cold.sum, cold.min, cold.max
    parts = [s for start, s in state.pending.items() if start < cold_until]
    parts += [s for start, s in state.buckets.items() if start >= cold_until]
    for statistics in parts:
        count += statistics.count
        total += statistics.sum
        if statistics.min is not None and (low is None or statistics.min < low):
            low = statistics.min
        if statistics.max is not None and (high is None or statistics.max > high):
            high = statistics.max
    if isinstance(total, float) and not math.isfinite(total):
        raise ValueError("Aggregation values must be finite")
    return BucketStatistics(count, total, low, high).quantity(func)


@dataclasses.dataclass
class LocalState:
    state: ReducerState | None = None
    # Uncontended, the lock is taken without yielding to the event loop.
    lock: anyio.Lock = dataclasses.field(
        default_factory=functools.partial(anyio.Lock, fast_acquire=True)
    )
    # Polar does not know the customer: it is not asked again before then, in seconds.
    missing_until: float = 0.0
    # Following the customer's updates channel: its state loads once this is set.
    following: anyio.Event = dataclasses.field(default_factory=anyio.Event)
    changed: anyio.Event = dataclasses.field(default_factory=anyio.Event)

    @property
    def missing(self) -> bool:
        return self.missing_until > time.time()

    def is_ready(self) -> bool:
        state = self.state
        return self.missing or (state is not None and state.cold_until is not None)

    def notify(self) -> None:
        self.changed.set()
        self.changed = anyio.Event()


class Configuration(typing.TypedDict):
    organization_id: str
    reducers: list[Reducer]


class Snapshot(typing.TypedDict):
    reducer_id: str
    customer_id: str | None
    external_customer_id: str | None
    customer_exists: bool
    version: int
    cold_until: int
    count: int
    sum: int | float
    min: int | float | None
    max: int | float | None


class Confirmed(typing.TypedDict):
    ids: list[str]
    # Read with the ids: it counts exactly those.
    snapshot: Snapshot


class Changes(typing.TypedDict):
    changes: list[Snapshot]
    cursor: str
    has_more: bool
    # Changes were missed: every snapshot may be stale.
    reset: bool
    configuration_changed: bool
    # Seconds.
    next_poll_in: float


@dataclasses.dataclass
class IngestResult:
    inserted: int
    duplicates: int = 0


# What Polar said of the pending events a snapshot seals.
@dataclasses.dataclass
class _Confirmation:
    snapshot: Snapshot
    started: float
    age: float
    messages: int = 0
    asked: int = 0
    confirmed: dict[int, list[str]] = dataclasses.field(default_factory=dict)


class Outpost:
    def __init__(
        self,
        redis_url: str,
        *,
        client: httpx.AsyncClient,
        telemetry: bool = True,
        confirm_timeout: float = CONFIRM_TIMEOUT,
    ) -> None:
        self.redis_url = redis_url
        self._client = client
        self._telemetry = is_telemetry_enabled(telemetry)
        self._tracer_provider: TracerProvider | None = None
        self._tracer: trace.Tracer = trace.NoOpTracer()
        self._meter_provider: MeterProvider | None = None
        self._ingest_duration: Histogram | None = None
        self._ingest_buckets: Counter | None = None
        self._read_duration: Histogram | None = None
        self._redis_memory: _Gauge | None = None
        self._redis_keys: _Gauge | None = None
        self._stack = contextlib.AsyncExitStack()
        self._redis: Redis | None = None
        self._connection_id: str | None = None
        self._failure: PolarOutpostError | None = None
        self._tasks: anyio.abc.TaskGroup | None = None
        self._reducers: list[Reducer] = []
        self._matchers: list[ReducerMatcher] = []
        self._requesting: set[str] = set()
        self._configured = anyio.Event()
        self._apply_snapshot: AsyncScript | None = None
        self._confirm_script: AsyncScript | None = None
        self._commit_pull: AsyncScript | None = None
        self._confirm_timeout = confirm_timeout
        # Snapshots and what they trigger run one at a time, in order.
        self._applying = anyio.Lock()
        self._pulled_at = 0.0
        self._pull_interval = PULL_INTERVAL
        self._pulled = anyio.Event()
        self._pulling: anyio.Event | None = None
        self._pull_retry_at = 0.0
        self._read_state: AsyncScript | None = None
        self._cache: collections.OrderedDict[str, LocalState] = (
            collections.OrderedDict()
        )
        self._synced = anyio.Event()
        self._redis_available = False
        self._channel = ""
        self._pubsub: PubSub | None = None
        self._prefix = KEY_VERSION
        self._sync_received = 0
        self._sync_applied = 0

    @classmethod
    def create(
        cls, polar: PolarClient, redis_url: str, *, telemetry: bool = True
    ) -> typing.Self:
        return cls(
            redis_url=redis_url, client=polar._client._client, telemetry=telemetry
        )

    @_raise_redis_unavailable
    async def __aenter__(self) -> typing.Self:
        if self._redis is not None:
            raise RuntimeError("Outpost is already connected")
        self._configured = anyio.Event()
        self._synced = anyio.Event()
        self._pulled = anyio.Event()
        self._pull_retry_at = 0.0
        self._failure = None
        if self._telemetry:
            self._tracer_provider = create_tracer_provider(self._client)
            self._tracer = self._tracer_provider.get_tracer("polar.outpost")
            self._meter_provider = create_meter_provider(self._client)
            meter = self._meter_provider.get_meter("polar.outpost")
            self._ingest_duration = meter.create_histogram(
                "outpost.ingest.duration", unit="s"
            )
            self._ingest_buckets = meter.create_counter("outpost.ingest.buckets")
            self._read_duration = meter.create_histogram(
                "outpost.read.duration", unit="s"
            )
            self._redis_memory = meter.create_gauge("outpost.redis.memory", unit="By")
            self._redis_keys = meter.create_gauge("outpost.redis.keys")
        try:
            with self._span("outpost.redis.connect"):
                self._redis = await self._stack.enter_async_context(
                    connect_redis(self.redis_url)
                )
            # Keys and channel carry the organization: organizations can share a Redis.
            await self._configure()
            self._channel = f"{self._prefix}:{self._redis.connection_pool.connection_kwargs.get('db', 0)}:updates"
            self._read_state = self._redis.register_script(READ_STATE_SCRIPT)
            self._apply_snapshot = self._redis.register_script(APPLY_SNAPSHOT_SCRIPT)
            self._confirm_script = self._redis.register_script(CONFIRM_SCRIPT)
            self._commit_pull = self._redis.register_script(COMMIT_PULL_SCRIPT)
            self._tasks = await self._stack.enter_async_context(
                anyio.create_task_group()
            )
            with anyio.fail_after(5):
                await self._tasks.start(self._listen_redis)
            self._connection_id = str(uuid.uuid4())
            pulled_at, next_poll_in, retry_at = await self._redis.hmget(
                self._pull_key, "pulled_at", "next_poll_in", "retry_at"
            )
            self._pulled_at = float(pulled_at) / 1000 if pulled_at else 0.0
            self._pull_interval = (
                float(next_poll_in) / 1000 if next_poll_in else PULL_INTERVAL
            )
            self._pull_retry_at = float(retry_at) / 1000 if retry_at else 0.0
            self._tasks.start_soon(self._pull_on_time)
        except BaseException:
            try:
                if self._tasks is not None:
                    self._tasks.cancel_scope.cancel()
                await self._stack.aclose()
            finally:
                self._redis = None
                self._connection_id = None
                self._tasks = None
                self._reducers = []
                self._matchers = []
                self._apply_snapshot = None
                self._confirm_script = None
                self._commit_pull = None
                self._read_state = None
                self._cache.clear()
                await self._shutdown_telemetry()
            raise
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None = None,
        exc_val: BaseException | None = None,
        exc_tb: types.TracebackType | None = None,
    ) -> None:
        self._report_sync()
        with self._span("outpost.redis.disconnect"):
            pass
        try:
            try:
                await self.flush()
            finally:
                if self._tasks is not None:
                    self._tasks.cancel_scope.cancel()
                await self._stack.__aexit__(exc_type, exc_val, exc_tb)
        finally:
            self._redis = None
            self._connection_id = None
            self._tasks = None
            self._reducers = []
            self._matchers = []
            self._requesting.clear()
            self._pulling = None
            self._apply_snapshot = None
            self._confirm_script = None
            self._commit_pull = None
            self._read_state = None
            self._cache.clear()
            await self._shutdown_telemetry()

    @property
    def connection_id(self) -> str | None:
        return self._connection_id

    @property
    def connected(self) -> bool:
        return (
            self._failure is None
            and self._redis_available
            and self._configured.is_set()
        )

    def validate(self, event: EventInput) -> None:
        """Reject an event Outpost cannot reconcile with Polar.

        Raises:
            MissingExternalIdError: The event has no external_id.
        """
        if not event.get("external_id"):
            raise MissingExternalIdError()

    @_raise_redis_unavailable
    async def track(self, event: EventInput) -> None:
        self._require_redis()
        started = time.perf_counter()
        outcome = "ok"
        try:
            self.validate(event)
            parsed = self._parse_event(event)
            updates = reduce(
                self._matchers,
                [parsed],
                oldest_bucket_start=get_bucket_start(parsed.timestamp),
            )
            if self._ingest_buckets is not None:
                self._ingest_buckets.add(len(updates))
            await self._warm_actor(parsed.external_customer_id)
            assert self._redis is not None
            writes: list[tuple[str, list[str | int | float]]] = []
            for (customer, reducer_id, bucket_start), statistics in updates.items():
                identity = f"{customer}:{reducer_id}"
                arguments: list[str | int | float] = [
                    f"{self._prefix}:state:{identity}",
                    f"{self._prefix}:pending:{identity}:{bucket_start}",
                    identity,
                    self._updates_channel(identity),
                    _generate_epoch(),
                    bucket_start,
                    statistics.count,
                    statistics.sum,
                    statistics.min if statistics.min is not None else "",
                    statistics.max if statistics.max is not None else "",
                    typing.cast(str, event["external_id"]),
                ]
                writes.append((identity, arguments))
            # Most events match one reducer: one EVALSHA writes its bucket. A pipeline only
            # pays off for several writes, and closing it costs two extra event-loop turns.
            if len(writes) == 1:
                try:
                    states = [
                        await self._redis.evalsha(WRITE_BUCKET_SHA, 2, *writes[0][1])
                    ]
                except NoScriptError as error:
                    states = [error]
            else:
                async with self._redis.pipeline(transaction=False) as pipeline:
                    for _, arguments in writes:
                        pipeline.evalsha(WRITE_BUCKET_SHA, 2, *arguments)
                    states = await pipeline.execute(raise_on_error=False)
            first_error: Exception | None = None
            for (identity, arguments), state in zip(writes, states, strict=True):
                # Redis caches the script with the first EVAL, so this happens once per server.
                if isinstance(state, NoScriptError):
                    try:
                        state = await self._redis.eval(
                            WRITE_BUCKET_SCRIPT, 2, *arguments
                        )
                    except RedisError as error:
                        state = error
                if isinstance(state, Exception):
                    if first_error is None:
                        first_error = state
                    continue
                await self._receive_state(identity, decode_state(state), bucket=True)
            if first_error is not None:
                raise first_error
        except BaseException:
            outcome = "error"
            raise
        finally:
            attributes = {"outpost.outcome": outcome}
            if self._ingest_duration is not None:
                self._ingest_duration.record(time.perf_counter() - started, attributes)

    async def confirm(self, events: collections.abc.Sequence[EventInput]) -> None:
        """Settle events Polar has ingested: their usage stays in its bucket, no longer pending.

        Args:
            events: Tracked events, including their external_id.
        """
        await self._settle(events, hot_only=False)

    async def acknowledge(self, events: collections.abc.Sequence[EventInput]) -> None:
        """Settle events Polar has received, in the buckets no snapshot has sealed yet.
        Events of a sealed bucket stay pending until a snapshot counts them.

        Args:
            events: Tracked events, including their external_id.
        """
        await self._settle(events, hot_only=True)

    @_raise_redis_unavailable
    async def _settle(
        self, events: collections.abc.Sequence[EventInput], *, hot_only: bool
    ) -> None:
        self._require_redis()
        groups: dict[tuple[str, int], list[str]] = {}
        for event in events:
            self.validate(event)
            parsed = self._parse_event(event)
            updates = reduce(
                self._matchers,
                [parsed],
                oldest_bucket_start=get_bucket_start(parsed.timestamp),
            )
            for customer, reducer_id, bucket_start in updates:
                identity = f"{customer}:{reducer_id}"
                groups.setdefault((identity, bucket_start), []).append(
                    typing.cast(str, event["external_id"])
                )
        assert self._redis is not None
        confirmations: list[tuple[str, list[str | int]]] = []
        async with self._redis.pipeline(transaction=False) as pipeline:
            for (identity, bucket_start), ids in groups.items():
                arguments: list[str | int] = [
                    f"{self._prefix}:state:{identity}",
                    f"{self._prefix}:pending:{identity}:{bucket_start}",
                    identity,
                    self._updates_channel(identity),
                    _generate_epoch(),
                    bucket_start,
                    "1" if hot_only else "",
                    *ids,
                ]
                confirmations.append((identity, arguments))
                pipeline.evalsha(CONFIRM_SHA, 2, *arguments)
            states = await pipeline.execute(raise_on_error=False)
        first_error: Exception | None = None
        for (identity, arguments), state in zip(confirmations, states, strict=True):
            if isinstance(state, NoScriptError):
                try:
                    state = await self._redis.eval(CONFIRM_SCRIPT, 2, *arguments)
                except RedisError as error:
                    state = error
            if isinstance(state, Exception):
                if first_error is None:
                    first_error = state
                continue
            # Nothing settled: the state did not change.
            if not state:
                continue
            await self._receive_state(identity, decode_state(state))
        if first_error is not None:
            raise first_error

    @_raise_redis_unavailable
    async def meter(
        self,
        *,
        meter_id: str,
        customer_id: str | None = None,
        external_customer_id: str | None = None,
    ) -> CustomerMeter | None:
        with self._measure_read("meter") as read:
            customer = self._customer_key(customer_id, external_customer_id)
            self._require_redis()
            await self._refresh()
            usage = self._find_reducer("usage", meter_id)
            if usage is None:
                read.outcome = "unknown_meter"
                raise UnknownMeterError(f"Outpost reduces no meter {meter_id}")
            credit = self._find_reducer("credit", meter_id)
            warmed = [
                (reducer, await self._warm_customer(customer, reducer))
                for reducer in (usage, credit)
                if reducer is not None
            ]
            if not all(local.is_ready() for _, local in warmed):
                with anyio.move_on_after(SNAPSHOT_TIMEOUT):
                    for _, local in warmed:
                        await self._wait_ready(local)
            if any(local.missing for _, local in warmed):
                read.outcome = "unknown_customer"
                return None
            state = warmed[0][1].state
            if state is None or state.cold_until is None:
                raise _NotReadyError("Customer snapshot is not ready")
            consumed = consumed_units(state, usage["aggregation"]["func"])
            credited: int | float = 0
            read.outcome = "ready"
            if credit is not None:
                credit_state = warmed[1][1].state
                if credit_state is not None and credit_state.cold_until is not None:
                    credited = consumed_units(
                        credit_state, credit["aggregation"]["func"]
                    )
                else:
                    read.outcome = "not_ready"
            return CustomerMeter(
                meter_id=meter_id,
                customer_id=customer_id,
                external_customer_id=external_customer_id,
                consumed_units=consumed,
                credited_units=credited,
                balance=credited - consumed,
            )

    @_raise_redis_unavailable
    async def actor(
        self,
        *,
        customer_id: str | None = None,
        external_customer_id: str | None = None,
    ) -> None:
        with self._measure_read("actor") as read:
            customer = self._customer_key(customer_id, external_customer_id)
            self._require_redis()
            await self._refresh()
            warmed = await self._warm_actor(customer)
            if not all(local.is_ready() for _, local in warmed):
                with anyio.move_on_after(SNAPSHOT_TIMEOUT):
                    for _, local in warmed:
                        await self._wait_ready(local)
            if not all(local.is_ready() for _, local in warmed):
                read.outcome = "not_ready"
            elif any(local.missing for _, local in warmed):
                read.outcome = "unknown_customer"
            else:
                read.outcome = "ready"

    async def flush(self, *, timeout: float = 30.0) -> None:
        """Wait for the pull in flight: a serverless function must not freeze in the
        middle of it."""
        with anyio.fail_after(timeout):
            if self._pulling is not None:
                await self._pulling.wait()
            async with self._applying:
                pass

    async def flush_telemetry(self) -> bool:
        tracer_provider = self._tracer_provider
        meter_provider = self._meter_provider
        if tracer_provider is None or meter_provider is None:
            return True
        self._report_sync()
        flushed = await anyio.to_thread.run_sync(tracer_provider.force_flush)
        return await anyio.to_thread.run_sync(meter_provider.force_flush) and flushed

    async def _warm_actor(self, customer: str) -> list[tuple[Reducer, LocalState]]:
        return [
            (reducer, await self._warm_customer(customer, reducer))
            for reducer in self._reducers
        ]

    def _find_reducer(
        self, kind: typing.Literal["usage", "credit"], meter_id: str
    ) -> Reducer | None:
        return next(
            (
                reducer
                for reducer in self._reducers
                if reducer["kind"] == kind and meter_id in reducer.get("meter_ids", [])
            ),
            None,
        )

    async def _wait_ready(self, local: LocalState) -> None:
        # Polar sends no snapshot without a connection.
        if not self.connected:
            return
        while not local.is_ready():
            await local.changed.wait()

    @contextlib.contextmanager
    def _measure_read(self, operation: str) -> collections.abc.Generator[_Read]:
        read = _Read()
        started = time.perf_counter()
        try:
            yield read
        except (UnavailableRedisError, RedisConnectionError, RedisTimeoutError):
            read.outcome = "redis_unavailable"
            raise
        except (TimeoutError, _NotReadyError, UnknownMeterError):
            raise
        except Exception:
            read.outcome = "error"
            raise
        finally:
            if self._read_duration is not None:
                self._read_duration.record(
                    time.perf_counter() - started,
                    {
                        "outpost.read.operation": operation,
                        "outpost.read.outcome": read.outcome,
                    },
                )

    @contextlib.contextmanager
    def _span(
        self, name: str, **attributes: AttributeValue
    ) -> collections.abc.Generator[Span]:
        if self._connection_id is not None:
            attributes["outpost.connection_id"] = self._connection_id
        span = self._tracer.start_span(
            name, context=otel_context.Context(), attributes=attributes
        )
        try:
            yield span
        except Exception as e:
            span.record_exception(e)
            span.set_status(StatusCode.ERROR)
            raise
        finally:
            span.end()

    def _report_sync(self) -> None:
        if self._sync_received == 0:
            return
        with self._span(
            "outpost.sync",
            **{
                "outpost.sync.received": self._sync_received,
                "outpost.sync.applied": self._sync_applied,
            },
        ):
            pass
        self._sync_received = 0
        self._sync_applied = 0

    async def _shutdown_telemetry(self) -> None:
        tracer_provider = self._tracer_provider
        meter_provider = self._meter_provider
        self._tracer_provider = None
        self._tracer = trace.NoOpTracer()
        self._meter_provider = None
        self._ingest_duration = None
        self._ingest_buckets = None
        self._read_duration = None
        self._redis_memory = None
        self._redis_keys = None
        with anyio.CancelScope(shield=True):
            if tracer_provider is not None:
                await anyio.to_thread.run_sync(tracer_provider.shutdown)
            if meter_provider is not None:
                await anyio.to_thread.run_sync(meter_provider.shutdown)

    def _customer_arguments(self, customer: str) -> dict[str, str]:
        kind, identifier = customer.split(":", 1)
        return {
            "customer_id" if kind == "customer" else "external_customer_id": identifier
        }

    def _require_redis(self) -> Redis:
        if self._failure is not None:
            raise self._failure
        if self._redis is None:
            raise RuntimeError("Use Outpost inside an async with block")
        return self._redis

    async def _warm_customer(self, customer: str, reducer: Reducer) -> LocalState:
        identity = f"{customer}:{reducer['id']}"
        self._require_redis()
        # Fail fast during an outage; only wait for a resync in progress.
        if not self._synced.is_set() and not self._redis_available:
            raise UnavailableRedisError()
        if not self._synced.is_set():
            with anyio.move_on_after(TIMEOUT):
                await self._synced.wait()
            if not self._synced.is_set():
                raise UnavailableRedisError()
        local = self._cache.get(identity)
        if local is None:
            # A customer's updates reach only the instances that read it.
            local = LocalState()
            self._cache[identity] = local
            await self._follow(identity, local)
            if len(self._cache) > CACHE_SIZE:
                evicted, _ = self._cache.popitem(last=False)
                if self._pubsub is not None:
                    with contextlib.suppress(RedisError):
                        await self._pubsub.unsubscribe(self._updates_channel(evicted))
        self._cache.move_to_end(identity)
        # The pull keeps every snapshot in the shared Redis current.
        if (
            local.state is not None and local.state.cold_until is not None
        ) or local.missing:
            return local
        async with local.lock:
            if local.state is None:
                # Followed first, so no update falls between the load and the subscription.
                await local.following.wait()
                local.state = await self._load_state(identity)
                local.notify()
            if local.state.cold_until is None and identity not in self._requesting:
                self._requesting.add(identity)
                assert self._tasks is not None
                self._tasks.start_soon(self._fetch, customer, reducer, identity)
        return local

    async def _follow(self, identity: str, local: LocalState) -> None:
        # Without a subscription, the reconnect subscribes and reloads every cached customer.
        if self._pubsub is not None:
            with contextlib.suppress(RedisError):
                await self._pubsub.subscribe(self._updates_channel(identity))
                return
        local.following.set()

    async def _fetch(self, customer: str, reducer: Reducer, identity: str) -> None:
        """One instance of the fleet asks Polar for a cold customer; the others get the
        state it applies."""
        lock = f"{self._prefix}:fetch:{identity}"
        token = uuid.uuid4().hex
        locked = False
        try:
            redis = self._require_redis()
            missing_until = await redis.hget(self._missing_key(identity), "retry_at")
            local = self._cache.get(identity)
            if missing_until and float(missing_until) > time.time() * 1000 and local:
                local.missing_until = float(missing_until) / 1000
                local.notify()
                return
            locked = bool(await redis.set(lock, token, px=int(TIMEOUT * 1000), nx=True))
            if not locked:
                return
            snapshots: list[Snapshot] = await self._request(
                "POST",
                "/v1/outpost/meter-usage",
                json={
                    **self._customer_arguments(customer),
                    "reducer_id": reducer["id"],
                },
            )
            async with self._applying:
                for snapshot in snapshots:
                    await self._receive_snapshot(snapshot, pulled=False)
        except Exception as error:  # noqa: BLE001
            self._fail_unless_transient(error)
        finally:
            # Asked again on the next read until a snapshot lands.
            self._requesting.discard(identity)
            # Past its TTL, the lock may be another instance's.
            if locked and self._redis is not None:
                with contextlib.suppress(RedisError):
                    await self._redis.eval(RELEASE_LOCK_SCRIPT, 1, lock, token)

    async def _load_state(self, customer: str) -> ReducerState:
        assert self._read_state is not None
        epoch = _generate_epoch()
        state = await self._read_state(
            keys=[f"{self._prefix}:state:{customer}"],
            args=[epoch],
        )
        return decode_state(state)

    # A bucket update carries one bucket: it applies only on top of the revision just before it.
    async def _receive_state(
        self, customer: str, state: ReducerState, *, bucket: bool = False
    ) -> bool:
        local = self._cache.get(customer)
        if local is None:
            return False
        async with local.lock:
            current = local.state
            if current is None:
                return False
            if current.epoch == state.epoch and current.revision >= state.revision:
                return False
            if current.epoch != state.epoch or (
                bucket and state.revision != current.revision + 1
            ):
                state = await self._load_state(customer)
            elif bucket:
                current.buckets.update(state.buckets)
                current.pending.update(state.pending)
                current.revision = state.revision
                state = current
            local.state = state
            local.notify()
            return True

    async def _receive_redis(self, data: bytes) -> None:
        update: StateUpdate = json.loads(data)
        if "pulled" in update:
            self._pulled_at = update["pulled"]["at"] / 1000
            self._pull_interval = update["pulled"]["next"] / 1000
            self._pull_retry_at = 0.0
            pulled, self._pulled = self._pulled, anyio.Event()
            pulled.set()
            return
        if "failed" in update:
            key, retry = update["failed"]["key"], update["failed"]["retry"] / 1000
            if key == self._pull_key:
                self._pull_retry_at = retry
                return
            local = self._cache.get(key.removeprefix(self._missing_key("")))
            if local is not None:
                local.missing_until = retry
                local.notify()
            return
        if "reset" in update:
            await self._refresh_states()
            return
        if "bucket" in update:
            applied = await self._receive_state(
                update["customer"], decode_state(update["bucket"]), bucket=True
            )
        else:
            applied = await self._receive_state(
                update["customer"], decode_state(update["state"])
            )
        self._sync_received += 1
        if applied:
            self._sync_applied += 1

    async def _refresh_states(self) -> None:
        for customer, local in list(self._cache.items()):
            async with local.lock:
                local.state = await self._load_state(customer)
                local.notify()

    async def _report_redis_size(self) -> None:
        """Includes whatever else the merchant keeps in that Redis."""
        redis, memory_gauge, keys_gauge = (
            self._redis,
            self._redis_memory,
            self._redis_keys,
        )
        if redis is None or memory_gauge is None or keys_gauge is None:
            return
        try:
            memory = await redis.info("memory")
            keys = await redis.dbsize()
        except RedisError:
            # A Redis that refuses INFO or DBSIZE reports nothing.
            return
        memory_gauge.set(memory["used_memory"])
        keys_gauge.set(keys)

    async def _listen_redis(
        self,
        *,
        task_status: anyio.abc.TaskStatus[None] = anyio.TASK_STATUS_IGNORED,
    ) -> None:
        started = False

        async def listen() -> None:
            nonlocal started
            async with self._require_redis().pubsub() as pubsub:
                with self._span("outpost.redis.subscribe"):
                    await pubsub.subscribe(
                        self._channel, *map(self._updates_channel, self._cache)
                    )
                    subscribed = await pubsub.get_message(timeout=5)
                    if subscribed is None or subscribed["type"] != "subscribe":
                        raise RedisTimeoutError(
                            "Outpost subscription was not acknowledged"
                        )
                    self._redis_available = True
                    self._pubsub = pubsub
                    await self._refresh_states()
                    self._synced.set()
                if not started:
                    task_status.started()
                    started = True
                next_refresh = anyio.current_time() + SYNC_INTERVAL
                while True:
                    message = await pubsub.get_message(timeout=1)
                    if message is None:
                        pass
                    elif message["type"] == "message":
                        await self._receive_redis(message["data"])
                    elif message["type"] == "subscribe":
                        channel = message["channel"].decode()
                        local = self._cache.get(
                            channel.removeprefix(self._updates_channel(""))
                        )
                        if local is not None:
                            local.following.set()
                    if anyio.current_time() >= next_refresh:
                        self._report_sync()
                        assert self._tasks is not None
                        self._tasks.start_soon(self._report_redis_size)
                        # Pub/sub delivers every update while connected: only a
                        # reconnect needs a resync.
                        next_refresh = anyio.current_time() + SYNC_INTERVAL

        async def disconnect(error: Exception) -> None:
            with self._span("outpost.redis.disconnect") as span:
                span.record_exception(error)
                span.set_status(StatusCode.ERROR)
            # Wake the reads waiting on a resync that just failed.
            stale, self._synced = self._synced, anyio.Event()
            stale.set()
            self._redis_available = False
            self._pubsub = None
            for local in self._cache.values():
                local.state = None
                local.following.set()

        # the failure count never resets, so after earlier outages
        # the first retry waits up to the 2s cap instead of the base delay.
        await Retry(RedisReconnectBackoff(), -1).call_with_retry(listen, disconnect)

    async def _request(
        self, method: str, path: str, **kwargs: typing.Any
    ) -> typing.Any:
        response = await self._client.request(method, path, **kwargs)
        if response.status_code in (401, 403):
            raise PolarOutpostError("Polar refused Outpost")
        response.raise_for_status()
        return response.json()

    @property
    def _pull_key(self) -> str:
        return f"{self._prefix}:pull"

    @property
    def _pull_lock_key(self) -> str:
        return f"{self._prefix}:pull:lock"

    async def _configure(self) -> None:
        configuration: Configuration = await self._request(
            "GET", "/v1/outpost/configuration"
        )
        self._prefix = f"{KEY_VERSION}:{configuration['organization_id']}"
        self._reducers = configuration["reducers"]
        self._matchers = with_matchers(self._reducers)
        self._configured.set()

    async def _refresh(self) -> None:
        """A read starts the pull once it is due, and waits for it once the Redis may be
        stale. While a failed pull backs off, it does neither; once the backoff ends, it
        no longer waits."""
        self._require_redis()
        age = time.time() - self._pulled_at
        if age < self._pull_interval or time.time() < self._pull_retry_at:
            return
        pulling = self._start_pull()
        if age >= 2 * self._pull_interval and not self._pull_retry_at:
            await pulling.wait()

    async def _pull(self) -> None:
        self._require_redis()
        await self._start_pull().wait()

    def _start_pull(self) -> anyio.Event:
        if self._pulling is None:
            assert self._tasks is not None
            self._pulling = anyio.Event()
            self._tasks.start_soon(self._run_pull, self._pulling)
        return self._pulling

    async def _pull_on_time(self) -> None:
        """A long-running process pulls on time, reads or not."""
        while True:
            await anyio.sleep(PULL_CHECK_INTERVAL)
            if (
                self._failure is None
                and time.time() - self._pulled_at >= self._pull_interval
                and time.time() >= self._pull_retry_at
            ):
                self._start_pull()

    async def _run_pull(self, done: anyio.Event) -> None:
        try:
            with self._span("outpost.pull") as span:
                await self._pull_changes(span)
        except Exception as error:  # noqa: BLE001
            # Polar or Redis failed: the next pull starts again from the same cursor, later.
            self._pull_retry_at = await self._back_off(self._pull_key)
            self._fail_unless_transient(error)
        finally:
            self._pulling = None
            done.set()

    async def _back_off(self, key: str, *forget: int) -> float:
        """One more failure on the key, for the whole fleet: when to try again."""
        now = int(time.time() * 1000)
        retry_at = now + int(PULL_RETRY_DELAY * 1000)
        if self._redis is not None:
            with contextlib.suppress(RedisError):
                retry_at = await self._redis.eval(
                    BACKOFF_SCRIPT,
                    1,
                    key,
                    now,
                    int(PULL_RETRY_DELAY * 1000),
                    int(MAX_PULL_RETRY_DELAY * 1000),
                    self._channel,
                    *forget,
                )
        return retry_at / 1000

    def _updates_channel(self, identity: str) -> str:
        return f"{self._channel}:{identity}"

    def _missing_key(self, identity: str) -> str:
        return f"{self._prefix}:missing:{identity}"

    async def _pull_changes(self, span: Span) -> None:
        """One instance of the fleet pulls at a time: the others learn the result through
        Redis."""
        redis = self._require_redis()
        assert self._commit_pull is not None
        # An instance that missed the message of a failed pull still waits for its backoff.
        retry_at = await redis.hget(self._pull_key, "retry_at")
        if retry_at and float(retry_at) > time.time() * 1000:
            self._pull_retry_at = float(retry_at) / 1000
            return
        lock = uuid.uuid4().hex
        pulled = self._pulled
        if not await redis.set(
            self._pull_lock_key, lock, px=int(PULL_LOCK_TTL * 1000), nx=True
        ):
            span.set_attribute("outpost.pull.locked", True)
            with anyio.move_on_after(TIMEOUT):
                await pulled.wait()
            return

        async def renew() -> None:
            # The page's snapshots and their confirms would outlast the lock otherwise.
            await redis.eval(
                EXTEND_LOCK_SCRIPT,
                1,
                self._pull_lock_key,
                lock,
                int(PULL_LOCK_TTL * 1000),
            )

        pages = 0
        applied = 0
        released = False
        try:
            while True:
                cursor = await redis.hget(self._pull_key, "cursor")
                params: dict[str, str | int] = {"limit": PULL_LIMIT}
                if cursor is not None:
                    params["cursor"] = _decode(cursor)
                try:
                    changes: Changes = await self._request(
                        "GET", "/v1/outpost/changes", params=params
                    )
                except httpx.HTTPStatusError as error:
                    # Only a rate limit clears on its own: any other 4xx would repeat forever.
                    if (
                        error.response.is_client_error
                        and error.response.status_code != 429
                    ):
                        raise PolarOutpostError("Polar rejected the pull") from error
                    raise
                pages += 1
                if changes["reset"]:
                    await self._reset()
                if changes["configuration_changed"]:
                    await self._configure()
                async with self._applying:
                    for snapshot in changes["changes"]:
                        if await self._receive_snapshot(
                            snapshot, pulled=True, renew=renew
                        ):
                            applied += 1
                            await renew()
                now = int(time.time() * 1000)
                next_poll_in = changes["next_poll_in"]
                committed = await self._commit_pull(
                    keys=[self._pull_key, self._pull_lock_key],
                    args=[
                        lock,
                        changes["cursor"],
                        now,
                        round(next_poll_in * 1000),
                        self._channel,
                        "" if changes["has_more"] else "1",
                    ],
                )
                if committed:
                    # The published "pulled" says the same, a little later.
                    self._pulled_at = now / 1000
                    self._pull_interval = next_poll_in
                    self._pull_retry_at = 0.0
                released = not committed or not changes["has_more"]
                if released:
                    break
        finally:
            span.set_attributes(
                {"outpost.pull.pages": pages, "outpost.pull.applied": applied}
            )
            if not released:
                with contextlib.suppress(RedisError):
                    await redis.eval(RELEASE_LOCK_SCRIPT, 1, self._pull_lock_key, lock)

    async def _reset(self) -> None:
        """Polar's changes went past its retention: no snapshot can be trusted any more."""
        redis = self._require_redis()
        async with redis.pipeline(transaction=False) as pipeline:
            async for key in redis.scan_iter(
                match=f"{self._prefix}:state:*", count=1000
            ):
                pipeline.hdel(key, "cold_until", "snapshot_version")
                if len(pipeline) >= 1000:
                    await pipeline.execute()
            await pipeline.execute()
        await redis.publish(self._channel, json.dumps({"reset": True}))

    def _fail_unless_transient(self, error: Exception) -> None:
        if not _is_connection_error(error):
            self._fail(error)

    def _fail(self, error: Exception) -> None:
        if not isinstance(error, PolarOutpostError):
            failure = PolarOutpostError("Outpost stopped")
            failure.__cause__ = error
            error = failure
        self._failure = error

    async def _receive_snapshot(
        self,
        snapshot: Snapshot,
        *,
        pulled: bool,
        renew: collections.abc.Callable[[], collections.abc.Awaitable[None]]
        | None = None,
    ) -> bool:
        """Applies a snapshot of Polar's, unless it was pulled for a customer nobody here
        reads."""
        if not any(
            reducer["id"] == snapshot["reducer_id"] for reducer in self._reducers
        ):
            return False
        if (
            snapshot["customer_id"] is not None
            and snapshot["external_customer_id"] is not None
        ):
            return False
        customer = self._customer_key(
            snapshot["customer_id"], snapshot["external_customer_id"]
        )
        identity = f"{customer}:{snapshot['reducer_id']}"
        local = self._cache.get(identity)
        if not snapshot["customer_exists"]:
            # The fleet asks again later, longer after each miss, and forgets the misses past
            # the longest wait.
            if local is not None or not pulled:
                missing_until = await self._back_off(
                    self._missing_key(identity), int(2 * MAX_PULL_RETRY_DELAY * 1000)
                )
                if local is not None:
                    local.missing_until = missing_until
                    local.notify()
            return False
        if local is not None and local.missing_until:
            local.missing_until = 0.0
            local.notify()
            with contextlib.suppress(RedisError):
                await self._require_redis().delete(self._missing_key(identity))
        statistics = [
            snapshot["count"],
            snapshot["sum"],
            snapshot["min"],
            snapshot["max"],
        ]
        if any(
            isinstance(value, float) and not math.isfinite(value)
            for value in statistics
        ):
            raise ValueError("Snapshot values must be finite")
        if (
            pulled
            and local is None
            and not await self._require_redis().exists(
                f"{self._prefix}:state:{identity}"
            )
        ):
            return False
        confirmation, answered = await self._ask_confirmation(
            identity, customer, snapshot, renew
        )
        await self._apply_snapshot_now(
            identity,
            customer,
            confirmation.snapshot if confirmation is not None else snapshot,
            confirmation,
            answered=answered,
        )
        return True

    async def _ask_confirmation(
        self,
        identity: str,
        customer: str,
        snapshot: Snapshot,
        renew: collections.abc.Callable[[], collections.abc.Awaitable[None]]
        | None = None,
    ) -> tuple[_Confirmation | None, bool]:
        """Asks Polar which of the pending events in the buckets the snapshot seals it
        counts. A request that fails leaves its events pending until a later snapshot."""
        started = time.perf_counter()
        local = self._cache.get(identity)
        state = (
            local.state
            if local is not None and local.state is not None
            else await self._load_state(identity)
        )
        sealed = [
            start
            for start, statistics in state.pending.items()
            if start < snapshot["cold_until"] and statistics.count > 0
        ]
        if not sealed:
            return None, False
        confirmation = _Confirmation(
            snapshot,
            started=started,
            # Seconds since the oldest bucket asked ended.
            age=(time.time_ns() / 1_000 - min(sealed) - BUCKET_SIZE) / 1_000_000,
        )
        assert self._redis is not None
        for bucket_start in sealed:
            ids = await self._redis.hkeys(
                f"{self._prefix}:pending:{identity}:{bucket_start}"
            )
            for offset in range(0, len(ids), CONFIRM_BATCH):
                batch = [
                    _decode(external_id)
                    for external_id in ids[offset : offset + CONFIRM_BATCH]
                ]
                confirmation.messages += 1
                confirmation.asked += len(batch)
                if renew is not None:
                    await renew()
                try:
                    with anyio.fail_after(self._confirm_timeout):
                        answer: Confirmed = await self._request(
                            "POST",
                            "/v1/outpost/confirm",
                            json={
                                "reducer_id": snapshot["reducer_id"],
                                **self._customer_arguments(customer),
                                "bucket_start": bucket_start,
                                "ids": batch,
                            },
                        )
                except (httpx.HTTPError, TimeoutError):
                    return confirmation, False
                confirmation.confirmed.setdefault(bucket_start, []).extend(
                    answer["ids"]
                )
                if answer["snapshot"]["version"] >= confirmation.snapshot["version"]:
                    confirmation.snapshot = answer["snapshot"]
        return confirmation, True

    async def _apply_snapshot_now(
        self,
        identity: str,
        customer: str,
        snapshot: Snapshot,
        confirmation: _Confirmation | None = None,
        *,
        answered: bool = False,
    ) -> None:
        """Settles the confirmed events and applies the snapshot in one transaction: a
        read sees the bucket either fully local or as Polar's total plus what is still
        pending."""
        applying = time.perf_counter()
        assert self._redis is not None
        assert self._apply_snapshot is not None
        assert self._confirm_script is not None
        key = f"{self._prefix}:state:{identity}"
        snapshot_arguments: list[str | int | float] = [
            identity,
            self._updates_channel(identity),
            _generate_epoch(),
            snapshot["cold_until"],
            snapshot["version"],
            snapshot["count"],
            snapshot["sum"],
            snapshot["min"] if snapshot["min"] is not None else "",
            snapshot["max"] if snapshot["max"] is not None else "",
        ]
        confirmed = {
            bucket_start: ids
            for bucket_start, ids in (
                confirmation.confirmed.items() if confirmation is not None else ()
            )
            if ids
        }
        with self._span(
            "outpost.snapshot.received",
            **{
                "outpost.customer": customer,
                "outpost.reducer_id": snapshot["reducer_id"],
                "outpost.snapshot_version": snapshot["version"],
            },
        ) as span:
            reducer_kind = next(
                (
                    reducer["kind"]
                    for reducer in self._reducers
                    if reducer["id"] == snapshot["reducer_id"]
                ),
                None,
            )
            if reducer_kind is not None:
                span.set_attribute("outpost.reducer_kind", reducer_kind)
            before = None
            if confirmed:
                async with self._redis.pipeline(transaction=True) as pipeline:
                    pipeline.hgetall(key)
                    for bucket_start, ids in confirmed.items():
                        await self._confirm_script(
                            keys=[
                                key,
                                f"{self._prefix}:pending:{identity}:{bucket_start}",
                            ],
                            args=[
                                identity,
                                self._updates_channel(identity),
                                _generate_epoch(),
                                bucket_start,
                                "",
                                *ids,
                            ],
                            client=pipeline,
                        )
                    await self._apply_snapshot(
                        keys=[key], args=snapshot_arguments, client=pipeline
                    )
                    results = await pipeline.execute()
                before, (state, replaced) = results[0], results[-1]
            else:
                state, replaced = await self._apply_snapshot(
                    keys=[key], args=snapshot_arguments
                )
            _report_local_value(span, snapshot, replaced, before)
            if confirmation is not None:
                span.set_attributes(
                    {
                        "outpost.pending.asked": confirmation.asked,
                        "outpost.pending.confirmed": sum(
                            len(ids) for ids in confirmed.values()
                        ),
                        "outpost.pending.answered": answered,
                        "outpost.pending.messages": confirmation.messages,
                        "outpost.pending.age": confirmation.age,
                        "outpost.confirm.duration": applying - confirmation.started,
                    }
                )
            await self._receive_state(identity, decode_state(state))

    def _parse_event(self, event: EventInput) -> Event:
        customer = self._customer_key(
            event.get("customer_id"), event.get("external_customer_id")
        )
        raw_timestamp = event.get("timestamp")
        if raw_timestamp is not None:
            timestamp = datetime.datetime.fromisoformat(raw_timestamp)
        else:
            timestamp = datetime.datetime.now(datetime.UTC)
        return Event(
            name=event["name"],
            external_customer_id=customer,
            timestamp=timestamp,
            metadata=event.get("metadata", {}),
        )

    def _customer_key(
        self, customer_id: str | None, external_customer_id: str | None
    ) -> str:
        if (customer_id is None) == (external_customer_id is None):
            raise ValueError("Provide exactly one customer_id or external_customer_id")
        if customer_id is not None:
            return f"customer:{customer_id}"
        return f"external:{external_customer_id}"
