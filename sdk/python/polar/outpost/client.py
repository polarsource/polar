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
from redis.exceptions import ResponseError as RedisResponseError
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
    SAMPLE_RATE_ATTRIBUTE,
    Outbox,
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
    method: collections.abc.Callable[
        typing.Concatenate["Outpost", _P],
        "types.CoroutineType[typing.Any, typing.Any, _R]",
    ],
) -> collections.abc.Callable[
    typing.Concatenate["Outpost", _P], "types.CoroutineType[typing.Any, typing.Any, _R]"
]:
    @functools.wraps(method)
    async def wrapper(self: "Outpost", /, *args: _P.args, **kwargs: _P.kwargs) -> _R:
        try:
            return await method(self, *args, **kwargs)
        except (RedisConnectionError, RedisTimeoutError) as error:
            self._lose_redis(error)
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


@contextlib.asynccontextmanager
async def connect_redis(url: str) -> collections.abc.AsyncGenerator[Redis, None]:
    async with Redis.from_url(
        url,
        retry=Retry(NoBackoff(), 0),
        socket_timeout=TIMEOUT,
        socket_connect_timeout=TIMEOUT,
    ) as redis:
        # A connection the server closes at once, as under a burst of new ones, is tried
        # again until the timeout.
        deadline = anyio.current_time() + TIMEOUT
        backoff = RedisReconnectBackoff()
        failures = 0
        while True:
            try:
                await redis.ping()
                break
            except (RedisConnectionError, RedisTimeoutError):
                failures += 1
                if anyio.current_time() >= deadline:
                    raise
                await anyio.sleep(backoff.compute(failures))
        yield redis


# Shared by every Outpost SDK: sdk/generator/outpost/constants.toml says what each one
# means. Durations are in seconds here.
KEY_VERSION = "outpost:v1"
TIMEOUT = 5.0
SNAPSHOT_TIMEOUT = 5.0
CONFIRM_TIMEOUT = 2.0
CONFIRM_BATCH = 1000
REPORT_INTERVAL = 30.0
SPAN_SAMPLE_RATE = 10
TELEMETRY_CAP = 1000
RELAY_LOCK_TTL = 30.0
POLL_INTERVAL = 0.025
REDIS_RECONNECT_DELAY = 0.1
MAX_REDIS_RECONNECT_DELAY = 2.0
PULL_INTERVAL = 30.0
PULL_LOCK_TTL = 10.0
PULL_RETRY_DELAY = 1.0
MAX_PULL_RETRY_DELAY = 30.0
PULL_LIMIT = 500
PULL_CONCURRENCY = 16
SNAPSHOT_BATCH = 500
FETCH_BATCH_WINDOW = 0.01
FETCH_CONCURRENCY = 3
FETCH_RETRY_DELAY = 0.1
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
redis.call('EXPIRE', KEYS[1], 86400)
return redis.call('HGETALL', KEYS[1])
"""

READ_STATE_SHA = hashlib.sha1(READ_STATE_SCRIPT.encode()).hexdigest()

WRITE_BUCKET_SCRIPT = """
local bucket = 'bucket:' .. ARGV[1] .. ':'
local pending = 'pending:' .. ARGV[1] .. ':'
local total = tonumber(redis.call('HGET', KEYS[1], bucket .. 'sum') or '0') + tonumber(ARGV[3])
assert(total == total and math.abs(total) ~= math.huge, 'Aggregation values must be finite')
for i, func in ipairs({'min', 'max'}) do
    local raw = ARGV[3 + i]
    if raw ~= '' then
        local value = tonumber(raw)
        assert(value and value == value and math.abs(value) ~= math.huge, 'Invalid value')
    end
end
-- One event pending: its value, or nothing when it only counts. An external_id Polar has not
-- confirmed yet: tracking it again changes nothing.
assert(ARGV[2] == '1', 'One event per write')
local entry = ARGV[4] ~= '' and ARGV[3] or ''
if redis.call('HSETNX', KEYS[2], ARGV[6], entry) == 0 then
    return 0
end
-- Every local event counts in its bucket; the pending part is what Polar has not confirmed.
for _, prefix in ipairs({bucket, pending}) do
    redis.call('HINCRBYFLOAT', KEYS[1], prefix .. 'sum', ARGV[3])
    redis.call('HINCRBY', KEYS[1], prefix .. 'count', ARGV[2])
    for i, func in ipairs({'min', 'max'}) do
        local raw = ARGV[3 + i]
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
redis.call('EXPIRE', KEYS[1], 86400)
return 1
"""

WRITE_BUCKET_SHA = hashlib.sha1(WRITE_BUCKET_SCRIPT.encode()).hexdigest()

CONFIRM_SCRIPT = """
local bucket = 'bucket:' .. ARGV[1] .. ':'
local pending = 'pending:' .. ARGV[1] .. ':'
local BATCH = 1000
-- Polar received the events but no snapshot counts them yet: a cold bucket keeps them
-- pending for the snapshot that will, a hot one counts them whole either way.
if ARGV[2] == '1' then
    local cutoff = redis.call('HGET', KEYS[1], 'cold_until')
    if cutoff and tonumber(ARGV[1]) < tonumber(cutoff) then
        return 0
    end
end
local ids = {}
for i = 3, #ARGV do table.insert(ids, ARGV[i]) end
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
    return 0
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
    if cutoff and tonumber(ARGV[1]) < tonumber(cutoff) then
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
redis.call('EXPIRE', KEYS[1], 86400)
return removed
"""

CONFIRM_SHA = hashlib.sha1(CONFIRM_SCRIPT.encode()).hexdigest()

APPLY_SNAPSHOT_SCRIPT = """
local cutoff = tonumber(ARGV[1])
local state = redis.call('HGETALL', KEYS[1])
local fields = {}
for i = 1, #state, 2 do fields[state[i]] = state[i + 1] end
-- The pull's reset count when Polar answered: a read after the next reset asks Polar again.
-- Recorded even for an older snapshot it rejects: Redis then holds a newer one than Polar's answer.
if ARGV[7] and fields['reset'] ~= ARGV[7] then
    if ARGV[7] == '' then
        redis.call('HDEL', KEYS[1], 'reset')
    else
        redis.call('HSET', KEYS[1], 'reset', ARGV[7])
    end
end
local current = fields['cold_until']
local previous = fields['snapshot_version']
-- Polar sends each snapshot to every instance: an older one changes nothing.
if (current and tonumber(current) > cutoff)
    or (previous and tonumber(ARGV[2]) < tonumber(previous)) then
    return {}
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
-- The snapshot another instance applied: nothing to write.
if not seals and stored('cold_until', ARGV[1]) and stored('cold:count', ARGV[3])
    and stored('cold:sum', ARGV[4]) and stored('cold:min', ARGV[5])
    and stored('cold:max', ARGV[6]) then
    redis.call('HSET', KEYS[1], 'snapshot_version', ARGV[2])
    redis.call('EXPIRE', KEYS[1], 86400)
    return {}
end
for i = 1, #dropped, 1000 do
    redis.call('HDEL', KEYS[1], unpack(dropped, i, math.min(i + 999, #dropped)))
end
redis.call('HSET', KEYS[1], 'cold_until', ARGV[1], 'snapshot_version', ARGV[2],
    'cold:count', ARGV[3], 'cold:sum', ARGV[4])
if ARGV[5] ~= '' then redis.call('HSET', KEYS[1], 'cold:min', ARGV[5]) end
if ARGV[6] ~= '' then redis.call('HSET', KEYS[1], 'cold:max', ARGV[6]) end
redis.call('EXPIRE', KEYS[1], 86400)
return replaced
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
-- '1' on the last page: the pull is over and the lock goes.
local last_page = ARGV[5] == '1'

if redis.call('GET', lock) ~= token then
    return 0
end
redis.call('HSET', pull, 'cursor', cursor, 'pulled_at', pulled_at, 'next_poll_in', next_poll_in)
-- A pull that succeeds ends the backoff.
redis.call('HDEL', pull, 'failures', 'retry_at')
if last_page then
    redis.call('DEL', lock)
end
return 1
"""

BACKOFF_SCRIPT = """
-- Counts one more failure in a row on a key the whole fleet shares, such as the pull's, and
-- says when to try again. Each failure in a row doubles the wait, up to a maximum.
local key = KEYS[1]
local now = tonumber(ARGV[1])
local first_delay = tonumber(ARGV[2])
local max_delay = tonumber(ARGV[3])
-- Optional: the key expires this many milliseconds later, and its failures with it.
local forget_after = ARGV[4]

local failures = redis.call('HINCRBY', key, 'failures', 1)
local delay = math.min(max_delay, first_delay * 2 ^ math.min(failures - 1, 16))
local retry_at = now + delay
redis.call('HSET', key, 'retry_at', retry_at)
if forget_after then
    redis.call('PEXPIRE', key, forget_after)
end
return retry_at
"""


@dataclasses.dataclass
class ReducerState:
    cold_until: int | None
    cold: BucketStatistics
    buckets: dict[int, BucketStatistics]
    # The part of each bucket Polar has not confirmed yet.
    pending: dict[int, BucketStatistics]
    # The pull's reset count when Polar last answered for it.
    confirmed_after_resets: int | None = None


def decode_state(values: collections.abc.Sequence[str | bytes]) -> ReducerState:
    cold_until: int | None = None
    cold = BucketStatistics()
    buckets: dict[int, BucketStatistics] = {}
    pending: dict[int, BucketStatistics] = {}
    confirmed_after_resets: int | None = None
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
                if field == "cold_until":
                    cold_until = int(value)
                elif field == "reset":
                    confirmed_after_resets = int(value)
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
        cold_until=cold_until,
        cold=cold,
        buckets=buckets,
        pending=pending,
        confirmed_after_resets=confirmed_after_resets,
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


# A customer's state for one reducer is None while Polar does not know the customer.
def _is_ready(state: ReducerState | None) -> bool:
    return state is None or state.cold_until is not None


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


def is_sampled(trace_id: int) -> bool:
    return (trace_id & 0xFFFFFFFF) % SPAN_SAMPLE_RATE == 0


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
        # The fetches in flight, by identity: each event is set once its fetch ends.
        self._requesting: dict[str, anyio.Event] = {}
        self._outbox = Outbox()
        self._queued: list[str] = []
        self._configured = anyio.Event()
        self._apply_snapshot: AsyncScript | None = None
        self._confirm_script: AsyncScript | None = None
        self._commit_pull: AsyncScript | None = None
        self._confirm_timeout = confirm_timeout
        # Snapshots and what they trigger run one at a time, in order.
        self._applying = anyio.Lock()
        self._pulled_at = 0.0
        self._pull_interval = PULL_INTERVAL
        self._pulling: anyio.Event | None = None
        self._relaying: anyio.Event | None = None
        self._pull_retry_at = 0.0
        self._read_state: AsyncScript | None = None
        self._redis_available = False
        self._prefix = KEY_VERSION
        # The configuration's revision in the pull hash, as of the configuration this
        # instance runs.
        self._configuration_revision: int | None = None
        # How many times Polar's changes went past their retention, as of the last read
        # of the pull hash.
        self._resets: int | None = None

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
        self._pull_retry_at = 0.0
        self._configuration_revision = None
        self._resets = None
        self._failure = None
        if self._telemetry:
            self._tracer_provider = create_tracer_provider(self._outbox)
            self._tracer = self._tracer_provider.get_tracer("polar.outpost")
            self._meter_provider = create_meter_provider(self._outbox)
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
            self._redis_available = True
            # Keys carry the organization: organizations can share a Redis.
            await self._configure()
            self._read_state = self._redis.register_script(READ_STATE_SCRIPT)
            self._apply_snapshot = self._redis.register_script(APPLY_SNAPSHOT_SCRIPT)
            self._confirm_script = self._redis.register_script(CONFIRM_SCRIPT)
            self._commit_pull = self._redis.register_script(COMMIT_PULL_SCRIPT)
            self._tasks = await self._stack.enter_async_context(
                anyio.create_task_group()
            )
            self._connection_id = str(uuid.uuid4())
            await self._load_pull()
            self._tasks.start_soon(self._pull_on_time)
            self._tasks.start_soon(self._report_on_time)
        except BaseException:
            try:
                if self._tasks is not None:
                    self._tasks.cancel_scope.cancel()
                await self._stack.aclose()
            finally:
                self._redis = None
                self._redis_available = False
                self._connection_id = None
                self._tasks = None
                self._reducers = []
                self._matchers = []
                self._apply_snapshot = None
                self._confirm_script = None
                self._commit_pull = None
                self._read_state = None
                await self._shutdown_telemetry()
            raise
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None = None,
        exc_val: BaseException | None = None,
        exc_tb: types.TracebackType | None = None,
    ) -> None:
        with self._span("outpost.redis.disconnect"):
            pass
        try:
            try:
                await self.flush()
                # Their last exports land in the outbox, which the shared Redis takes
                # before it closes.
                await self._shutdown_telemetry()
                await self._push_telemetry()
            finally:
                if self._tasks is not None:
                    self._tasks.cancel_scope.cancel()
                await self._stack.__aexit__(exc_type, exc_val, exc_tb)
        finally:
            self._redis = None
            self._redis_available = False
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
            assert self._redis is not None
            writes: list[list[str | int | float]] = []
            for (customer, reducer_id, bucket_start), statistics in updates.items():
                identity = f"{customer}:{reducer_id}"
                arguments: list[str | int | float] = [
                    f"{self._prefix}:state:{identity}",
                    f"{self._prefix}:pending:{identity}:{bucket_start}",
                    bucket_start,
                    statistics.count,
                    statistics.sum,
                    statistics.min if statistics.min is not None else "",
                    statistics.max if statistics.max is not None else "",
                    typing.cast(str, event["external_id"]),
                ]
                writes.append(arguments)
            # Most events match one reducer: one EVALSHA writes its bucket. A pipeline only
            # pays off for several writes, and closing it costs two extra event-loop turns.
            if len(writes) == 1:
                try:
                    results = [
                        await self._redis.evalsha(WRITE_BUCKET_SHA, 2, *writes[0])
                    ]
                except NoScriptError as error:
                    results = [error]
            else:
                async with self._redis.pipeline(transaction=False) as pipeline:
                    for arguments in writes:
                        pipeline.evalsha(WRITE_BUCKET_SHA, 2, *arguments)
                    results = await pipeline.execute(raise_on_error=False)
            first_error: Exception | None = None
            for arguments, result in zip(writes, results, strict=True):
                # Redis caches the script with the first EVAL, so this happens once per server.
                if isinstance(result, NoScriptError):
                    try:
                        result = await self._redis.eval(
                            WRITE_BUCKET_SCRIPT, 2, *arguments
                        )
                    except RedisError as error:
                        result = error
                if isinstance(result, Exception) and first_error is None:
                    first_error = result
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
        confirmations: list[list[str | int]] = []
        async with self._redis.pipeline(transaction=False) as pipeline:
            for (identity, bucket_start), ids in groups.items():
                arguments: list[str | int] = [
                    f"{self._prefix}:state:{identity}",
                    f"{self._prefix}:pending:{identity}:{bucket_start}",
                    bucket_start,
                    "1" if hot_only else "",
                    *ids,
                ]
                confirmations.append(arguments)
                pipeline.evalsha(CONFIRM_SHA, 2, *arguments)
            results = await pipeline.execute(raise_on_error=False)
        first_error: Exception | None = None
        for arguments, result in zip(confirmations, results, strict=True):
            if isinstance(result, NoScriptError):
                try:
                    result = await self._redis.eval(CONFIRM_SCRIPT, 2, *arguments)
                except RedisError as error:
                    result = error
            if isinstance(result, Exception) and first_error is None:
                first_error = result
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
            states = await self._read(
                customer, [usage] if credit is None else [usage, credit]
            )
            state = states[0]
            credit_state = states[1] if credit is not None else None
            if state is None or (credit is not None and credit_state is None):
                read.outcome = "unknown_customer"
                return None
            if state.cold_until is None:
                raise _NotReadyError("Customer snapshot is not ready")
            consumed = consumed_units(state, usage["aggregation"]["func"])
            credited: int | float = 0
            read.outcome = "ready"
            if credit is not None:
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
            states = await self._read(customer, self._reducers)
            if not all(map(_is_ready, states)):
                read.outcome = "not_ready"
            elif None in states:
                read.outcome = "unknown_customer"
            else:
                read.outcome = "ready"

    async def flush(self, *, timeout: float = 30.0) -> None:
        """Wait for the pull and the fetches in flight: a serverless function must not
        freeze in the middle of them."""
        with anyio.fail_after(timeout):
            if self._pulling is not None:
                await self._pulling.wait()
            if self._relaying is not None:
                await self._relaying.wait()
            for fetching in list(self._requesting.values()):
                await fetching.wait()
            async with self._applying:
                pass

    async def flush_telemetry(self) -> bool:
        """Hands this instance's telemetry to the shared Redis, where the next pull
        sends it to Polar."""
        tracer_provider = self._tracer_provider
        meter_provider = self._meter_provider
        if tracer_provider is None or meter_provider is None:
            return True
        flushed = await anyio.to_thread.run_sync(tracer_provider.force_flush)
        flushed = await anyio.to_thread.run_sync(meter_provider.force_flush) and flushed
        await self._push_telemetry()
        return flushed

    async def _push_telemetry(self) -> None:
        spans, metrics = self._outbox.take()
        if self._redis is None or not (spans or metrics):
            return
        try:
            async with self._redis.pipeline(transaction=False) as pipeline:
                for kind, exports in (("spans", spans), ("metrics", metrics)):
                    if not exports:
                        continue
                    key = self._telemetry_key(kind)
                    pipeline.rpush(key, *exports)
                    # A fleet that stops pulling keeps its newest exports only.
                    pipeline.ltrim(key, -TELEMETRY_CAP, -1)
                await pipeline.execute()
        except RedisError:
            self._outbox.put_back(spans, metrics, TELEMETRY_CAP)

    def _telemetry_key(self, kind: str) -> str:
        return f"{self._prefix}:telemetry:{kind}"

    async def _relay_telemetry(self) -> None:
        """The pulling instance relays the fleet's telemetry, one request of each kind:
        protobuf messages concatenate into one whose repeated fields add up."""
        if self._tracer_provider is None:
            return
        redis = self._require_redis()
        lock = f"{self._prefix}:telemetry:lock"
        token = uuid.uuid4().hex
        if not await redis.set(lock, token, px=int(RELAY_LOCK_TTL * 1000), nx=True):
            return
        try:
            for kind, path in (
                ("spans", "/v1/outpost/telemetry"),
                ("metrics", "/v1/outpost/telemetry/metrics"),
            ):
                key = self._telemetry_key(kind)
                batch = f"{key}:relaying"
                # A batch Polar failed goes first; otherwise the list moves aside, and
                # exports written meanwhile start a new one.
                if not await redis.exists(batch):
                    with contextlib.suppress(RedisResponseError):
                        await redis.rename(key, batch)
                exports = typing.cast(list[bytes], await redis.lrange(batch, 0, -1))
                if not exports:
                    continue
                response = await self._client.post(
                    path,
                    content=b"".join(exports),
                    headers={"Content-Type": "application/x-protobuf"},
                )
                # One Polar refused would be refused again.
                if response.status_code < 500 and response.status_code != 429:
                    await redis.delete(batch)
        finally:
            with contextlib.suppress(RedisError):
                await redis.eval(RELEASE_LOCK_SCRIPT, 1, lock, token)

    async def _read(
        self, customer: str, reducers: list[Reducer]
    ) -> list[ReducerState | None]:
        """Reads the customer's states from Redis. One Polar has no snapshot of yet is
        asked for once, then read again until it lands."""
        deadline = anyio.current_time() + SNAPSHOT_TIMEOUT
        states = await self._load(customer, reducers)
        # Polar sends no snapshot without a connection.
        if not self.connected:
            return states
        # A state confirmed before the last reset serves the read while Polar confirms
        # it again.
        fetches = [
            self._fetch(customer, reducer)
            for reducer, state in zip(reducers, states, strict=True)
            if not _is_ready(state) or self._is_stale(state)
        ]
        if all(map(_is_ready, states)):
            return states
        with anyio.move_on_after(deadline - anyio.current_time()):
            for fetched in fetches:
                await fetched.wait()
        while True:
            states = await self._load(customer, reducers)
            if all(map(_is_ready, states)) or anyio.current_time() >= deadline:
                return states
            await anyio.sleep(min(POLL_INTERVAL, deadline - anyio.current_time()))

    async def _load(
        self, customer: str, reducers: list[Reducer]
    ) -> list[ReducerState | None]:
        """One round trip: each reducer's state, unless Polar does not know the customer."""
        redis = self._require_redis()
        keys = [
            f"{self._prefix}:state:{customer}:{reducer['id']}" for reducer in reducers
        ]
        async with redis.pipeline(transaction=False) as pipeline:
            for key, reducer in zip(keys, reducers, strict=True):
                pipeline.evalsha(READ_STATE_SHA, 1, key)
                pipeline.hget(
                    self._missing_key(f"{customer}:{reducer['id']}"), "retry_at"
                )
            pipeline.hget(self._pull_key, "reset")
            results = await pipeline.execute(raise_on_error=False)
        resets = results.pop()
        if isinstance(resets, Exception):
            raise resets
        self._resets = None if resets is None else int(resets)
        now = time.time() * 1000
        states: list[ReducerState | None] = []
        for key, state, retry_at in zip(keys, results[::2], results[1::2], strict=True):
            # Redis caches the script with the first EVAL, so this happens once per server.
            if isinstance(state, NoScriptError):
                state = await redis.eval(READ_STATE_SCRIPT, 1, key)
            for result in (state, retry_at):
                if isinstance(result, Exception):
                    raise result
            states.append(
                None if retry_at and float(retry_at) > now else decode_state(state)
            )
        return states

    def _is_stale(self, state: ReducerState | None) -> bool:
        return state is not None and state.confirmed_after_resets != self._resets

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
        if is_sampled(span.get_span_context().trace_id):
            span.set_attribute(SAMPLE_RATE_ATTRIBUTE, SPAN_SAMPLE_RATE)
        try:
            yield span
        except Exception as e:
            span.record_exception(e)
            span.set_status(StatusCode.ERROR)
            raise
        finally:
            span.end()

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
        # Fail fast during an outage: the reconnect says when Redis answers again.
        if not self._redis_available:
            raise RedisConnectionError("Redis is unavailable")
        return self._redis

    def _fetch(self, customer: str, reducer: Reducer) -> anyio.Event:
        """Queues the identity once. The instance holding the cold lock asks Polar for
        the fleet's cold customers together and applies their states."""
        identity = f"{customer}:{reducer['id']}"
        fetching = self._requesting.get(identity)
        if fetching is None:
            fetching = self._requesting[identity] = anyio.Event()
            self._queued.append(identity)
            if len(self._queued) == 1:
                assert self._tasks is not None
                self._tasks.start_soon(self._fetch_queued)
        return fetching

    async def _fetch_queued(self) -> None:
        await anyio.lowlevel.checkpoint()
        queued, self._queued = self._queued, []
        try:
            redis = self._require_redis()
            # A customer already queued or asked for stays out of the queue until Polar
            # answers.
            async with redis.pipeline(transaction=False) as pipeline:
                for identity in queued:
                    pipeline.set(
                        f"{self._prefix}:fetch:{identity}",
                        1,
                        px=int(TIMEOUT * 1000),
                        nx=True,
                    )
                marked = await pipeline.execute()
            identities = [
                identity for identity, ok in zip(queued, marked, strict=True) if ok
            ]
            if identities:
                await redis.sadd(self._cold_key, *identities)
            await self._drain_cold()
        except Exception as error:  # noqa: BLE001
            self._fail_unless_transient(error)
        finally:
            for identity in queued:
                done = self._requesting.pop(identity, None)
                if done is not None:
                    done.set()

    async def _drain_cold(self) -> None:
        """Once it lets go of the lock, the instance looks again: a customer queued while
        it held the lock is not left behind."""
        redis = self._require_redis()
        while True:
            token = uuid.uuid4().hex
            if not await redis.set(
                self._cold_lock_key, token, px=int(TIMEOUT * 1000), nx=True
            ):
                return
            try:
                await anyio.sleep(FETCH_BATCH_WINDOW)

                async def renew(token: str = token) -> None:
                    await redis.eval(
                        EXTEND_LOCK_SCRIPT,
                        1,
                        self._cold_lock_key,
                        token,
                        int(TIMEOUT * 1000),
                    )

                while True:
                    batches: list[list[str]] = []
                    while len(batches) < FETCH_CONCURRENCY:
                        popped = typing.cast(
                            list[bytes],
                            await redis.spop(self._cold_key, SNAPSHOT_BATCH),
                        )
                        identities = [_decode(item) for item in popped]
                        if not identities:
                            break
                        batches.append(identities)
                    if not batches:
                        break
                    await renew()
                    # A few batches at once: the cold start lasts as long as the
                    # slowest, not their sum.
                    async with anyio.create_task_group() as group:
                        for identities in batches:
                            group.start_soon(self._fetch_batch, identities, renew)
            finally:
                # Past its TTL, the lock may be another instance's.
                with contextlib.suppress(RedisError):
                    await redis.eval(RELEASE_LOCK_SCRIPT, 1, self._cold_lock_key, token)
            if not await redis.scard(self._cold_key):
                return

    async def _fetch_batch(
        self,
        identities: list[str],
        renew: collections.abc.Callable[[], collections.abc.Awaitable[None]],
    ) -> None:
        redis = self._require_redis()
        try:
            requested = []
            for identity in identities:
                customer, reducer_id = identity.rsplit(":", 1)
                requested.append(
                    {**self._customer_arguments(customer), "reducer_id": reducer_id}
                )
            resets = self._resets
            deadline = anyio.current_time() + SNAPSHOT_TIMEOUT

            async def ask() -> list[Snapshot]:
                """Its reads still wait: a failure that may pass is asked for again until
                they give up."""
                delay = FETCH_RETRY_DELAY
                while True:
                    try:
                        return await self._request(
                            "POST",
                            "/v1/outpost/meter-usage",
                            json={"identities": requested},
                        )
                    except (httpx.HTTPStatusError, httpx.TransportError) as error:
                        response = getattr(error, "response", None)
                        if response is not None and (
                            response.is_client_error and response.status_code != 429
                        ):
                            raise
                        retry_after = (
                            response.headers.get("retry-after")
                            if response is not None
                            else None
                        )
                        wait = (
                            float(retry_after)
                            if retry_after and retry_after.isdecimal()
                            else delay
                        )
                        if anyio.current_time() + wait >= deadline:
                            raise
                        await anyio.sleep(wait)
                        await renew()
                        delay *= 2

            snapshots = await ask()
            # Side by side, as a pulled page: one instance applies the snapshots of the
            # fleet.
            limiter = anyio.CapacityLimiter(PULL_CONCURRENCY)

            async def apply(snapshot: Snapshot) -> None:
                async with limiter:
                    if await self._receive_snapshot(
                        snapshot, pulled=False, resets=resets, renew=renew
                    ):
                        await renew()

            async with self._applying, anyio.create_task_group() as group:
                for snapshot in snapshots:
                    group.start_soon(apply, snapshot)
        finally:
            with contextlib.suppress(RedisError):
                await redis.delete(
                    *(f"{self._prefix}:fetch:{identity}" for identity in identities)
                )

    async def _load_state(self, identity: str) -> ReducerState:
        assert self._read_state is not None
        state = await self._read_state(keys=[f"{self._prefix}:state:{identity}"])
        return decode_state(state)

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

    async def _report_on_time(self) -> None:
        while True:
            await anyio.sleep(REPORT_INTERVAL)
            await self._report_redis_size()
            await self.flush_telemetry()

    def _lose_redis(self, error: Exception) -> None:
        """Reads and writes fail fast until Redis answers again."""
        if not self._redis_available or self._tasks is None:
            return
        self._redis_available = False
        with self._span("outpost.redis.disconnect") as span:
            span.record_exception(error)
            span.set_status(StatusCode.ERROR)
        self._tasks.start_soon(self._reconnect)

    async def _reconnect(self) -> None:
        redis = self._redis
        assert redis is not None

        async def ignore(error: Exception) -> None:
            pass

        await Retry(RedisReconnectBackoff(), -1).call_with_retry(redis.ping, ignore)
        self._redis_available = True

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

    @property
    def _cold_key(self) -> str:
        return f"{self._prefix}:cold"

    @property
    def _cold_lock_key(self) -> str:
        return f"{self._prefix}:cold:lock"

    @property
    def _configuration_key(self) -> str:
        """A new instance reads its token's configuration from Redis instead of Polar.
        The key hashes the token: Redis never sees it."""
        headers = self._client.headers
        sent = [
            str(self._client.base_url.join("/v1/outpost/configuration")),
            headers.get("authorization"),
            headers.get("polar-organization"),
        ]
        # Compact, as JSON.stringify writes it: both SDKs share the key.
        identity = hashlib.sha256(
            json.dumps(sent, separators=(",", ":")).encode()
        ).hexdigest()
        return f"{KEY_VERSION}:configuration:{identity}"

    async def _configure(
        self, source: typing.Literal["redis", "polar", "either"] = "either"
    ) -> bool:
        """From "redis", the organization's copy: each token reloads it once the pull
        hash says the configuration changed. False when Redis holds none."""
        redis = self._require_redis()
        key = (
            f"{self._prefix}:configuration"
            if source == "redis"
            else self._configuration_key
        )
        stored = None if source == "polar" else await redis.get(key)
        if not stored and source == "redis":
            return False
        configuration: Configuration = (
            json.loads(stored)
            if stored
            else await self._request("GET", "/v1/outpost/configuration")
        )
        prefix = f"{KEY_VERSION}:{configuration['organization_id']}"
        if not stored:
            dumped = json.dumps(configuration)
            await redis.set(self._configuration_key, dumped)
            # Only the pull writes the organization's copy: a fetch at start may be
            # older than it.
            if source == "polar":
                await redis.set(f"{prefix}:configuration", dumped)
        self._prefix = prefix
        self._reducers = configuration["reducers"]
        self._matchers = with_matchers(self._reducers)
        self._configured.set()
        return True

    async def _refresh(self) -> None:
        """Starts the pull once due and no other instance pulled since. Waits for it, at
        most SNAPSHOT_TIMEOUT, once Redis may be stale, unless the last pull failed."""
        if not self._pull_due():
            return
        await self._load_pull()
        if not self._pull_due():
            return
        age = time.time() - self._pulled_at
        pulling = self._start_pull()
        if age >= 2 * self._pull_interval and not self._pull_retry_at:
            with anyio.move_on_after(SNAPSHOT_TIMEOUT):
                await pulling.wait()

    def _pull_due(self) -> bool:
        now = time.time()
        return (
            now - self._pulled_at >= self._pull_interval and now >= self._pull_retry_at
        )

    async def _load_pull(self) -> None:
        (
            pulled_at,
            next_poll_in,
            retry_at,
            revision,
            resets,
        ) = await self._require_redis().hmget(
            self._pull_key,
            "pulled_at",
            "next_poll_in",
            "retry_at",
            "configuration",
            "reset",
        )
        # Another instance pulled a new configuration, maybe while this one started.
        # Redis holds it; once Redis lost it, the next read tries again.
        configured = None if revision is None else int(revision)
        if configured != self._configuration_revision and await self._configure(
            "redis"
        ):
            self._configuration_revision = configured
        self._pulled_at = float(pulled_at) / 1000 if pulled_at else 0.0
        self._pull_interval = (
            float(next_poll_in) / 1000 if next_poll_in else PULL_INTERVAL
        )
        self._pull_retry_at = float(retry_at) / 1000 if retry_at else 0.0
        self._resets = None if resets is None else int(resets)

    async def _wait_for_pull(self) -> None:
        """Another instance holds the pull: it has ended, pulled or failed, once its lock
        is gone."""
        redis = self._require_redis()
        with anyio.move_on_after(TIMEOUT):
            while await redis.exists(self._pull_lock_key):
                await anyio.sleep(POLL_INTERVAL)
        await self._load_pull()

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
            if self._failure is None:
                with contextlib.suppress(RedisError):
                    await self._refresh()

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
                    *forget,
                )
        return retry_at / 1000

    def _missing_key(self, identity: str) -> str:
        return f"{self._prefix}:missing:{identity}"

    async def _pull_changes(self, span: Span) -> None:
        """One instance of the fleet pulls at a time: the others learn the result through
        Redis."""
        redis = self._require_redis()
        assert self._commit_pull is not None
        # A pull another instance failed still holds the fleet back.
        retry_at = await redis.hget(self._pull_key, "retry_at")
        if retry_at and float(retry_at) > time.time() * 1000:
            self._pull_retry_at = float(retry_at) / 1000
            return
        lock = uuid.uuid4().hex
        if not await redis.set(
            self._pull_lock_key, lock, px=int(PULL_LOCK_TTL * 1000), nx=True
        ):
            span.set_attribute("outpost.pull.locked", True)
            await self._wait_for_pull()
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
                    self._resets = await redis.hincrby(self._pull_key, "reset", 1)
                if changes["configuration_changed"]:
                    await self._configure("polar")
                    self._configuration_revision = await redis.hincrby(
                        self._pull_key, "configuration", 1
                    )
                # Each customer's snapshots apply in order; customers apply side by side.
                customers: dict[tuple[str, str | None, str | None], list[Snapshot]] = {}
                for snapshot in changes["changes"]:
                    customers.setdefault(
                        (
                            snapshot["reducer_id"],
                            snapshot["customer_id"],
                            snapshot["external_customer_id"],
                        ),
                        [],
                    ).append(snapshot)
                limiter = anyio.CapacityLimiter(PULL_CONCURRENCY)

                async def apply(
                    snapshots: list[Snapshot],
                    limiter: anyio.CapacityLimiter,
                    resets: int | None,
                ) -> None:
                    nonlocal applied
                    async with limiter:
                        for snapshot in snapshots:
                            if await self._receive_snapshot(
                                snapshot, pulled=True, resets=resets, renew=renew
                            ):
                                applied += 1
                                await renew()

                async with self._applying, anyio.create_task_group() as group:
                    for snapshots in customers.values():
                        group.start_soon(apply, snapshots, limiter, self._resets)
                now = int(time.time() * 1000)
                next_poll_in = changes["next_poll_in"]
                committed = await self._commit_pull(
                    keys=[self._pull_key, self._pull_lock_key],
                    args=[
                        lock,
                        changes["cursor"],
                        now,
                        round(next_poll_in * 1000),
                        "" if changes["has_more"] else "1",
                    ],
                )
                if committed:
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
        # In the background: a read that waits for the pull does not wait for telemetry.
        if self._relaying is None and self._tasks is not None:
            self._relaying = anyio.Event()
            self._tasks.start_soon(self._relay_in_background, self._relaying)

    async def _relay_in_background(self, done: anyio.Event) -> None:
        try:
            # Telemetry is best effort: no failure of it stops Outpost.
            with contextlib.suppress(Exception):
                await self._relay_telemetry()
        finally:
            self._relaying = None
            done.set()

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
        resets: int | None,
        renew: collections.abc.Callable[[], collections.abc.Awaitable[None]]
        | None = None,
    ) -> bool:
        """Applies Polar's snapshot, unless pulled for a customer nobody here reads.
        `resets` is the reset count when asked: after another reset, reads ask again."""
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
        # A pulled snapshot of a customer nobody here reads or writes has no state in Redis.
        if pulled and not await self._require_redis().exists(
            f"{self._prefix}:state:{identity}"
        ):
            return False
        if not snapshot["customer_exists"]:
            # The fleet asks again later, longer after each miss, and forgets the misses past
            # the longest wait.
            await self._back_off(
                self._missing_key(identity), int(2 * MAX_PULL_RETRY_DELAY * 1000)
            )
            return False
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
        confirmation, answered = await self._ask_confirmation(
            identity, customer, snapshot, renew
        )
        await self._apply_snapshot_now(
            identity,
            customer,
            confirmation.snapshot if confirmation is not None else snapshot,
            confirmation,
            answered=answered,
            resets=resets,
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
        state = await self._load_state(identity)
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
        resets: int | None,
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
            snapshot["cold_until"],
            snapshot["version"],
            snapshot["count"],
            snapshot["sum"],
            snapshot["min"] if snapshot["min"] is not None else "",
            snapshot["max"] if snapshot["max"] is not None else "",
            resets if resets is not None else "",
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
                            args=[bucket_start, "", *ids],
                            client=pipeline,
                        )
                    await self._apply_snapshot(
                        keys=[key], args=snapshot_arguments, client=pipeline
                    )
                    results = await pipeline.execute()
                before, replaced = results[0], results[-1]
            else:
                replaced = await self._apply_snapshot(
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
