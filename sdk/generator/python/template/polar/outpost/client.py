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
import httpx2
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
from polar.logging import get_logger
from polar.metering.client import PolarClient
from polar.metering.errors import (
    DropReason,
    UnknownMeterError,
    retry_after_seconds,
    validate_timeout,
)
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


class NotReadyError(PolarOutpostError):
    """A read Outpost cannot answer yet: Polar has not sent the customer's snapshot
    in time."""


# The reset count of a state whose snapshot Polar did not confirm.
UNCONFIRMED = -1

# NaN and the infinities are not JSON: no flusher could send an event that holds one.
_encode_event = json.JSONEncoder(allow_nan=False).encode


def _not_json(constant: str) -> typing.NoReturn:
    raise ValueError(f"{constant} is not JSON")


def _finite(number: str) -> float:
    value = float(number)
    return value if math.isfinite(value) else _not_json(number)


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
            httpx2.HTTPError,
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
KEY_VERSION = "{{ outpost_constants.key_version }}"
TIMEOUT = {{ outpost_constants.timeout / 1000 }}
SNAPSHOT_TIMEOUT = {{ outpost_constants.snapshot_timeout / 1000 }}
CONFIRM_TIMEOUT = {{ outpost_constants.confirm_timeout / 1000 }}
CONFIRM_BATCH = {{ outpost_constants.confirm_batch }}
OUTBOX_BATCH = {{ outpost_constants.outbox_batch }}
FLUSHERS = {{ outpost_constants.flushers }}
OUTBOX_CLAIM_IDLE = {{ outpost_constants.outbox_claim_idle / 1000 }}
FLUSHER_LOCK_TTL = {{ outpost_constants.flusher_lock_ttl / 1000 }}
DRAIN_INTERVAL = {{ outpost_constants.drain_interval / 1000 }}
OUTBOX_RETRY_DELAY = {{ outpost_constants.outbox_retry_delay / 1000 }}
MAX_OUTBOX_RETRY_DELAY = {{ outpost_constants.max_outbox_retry_delay / 1000 }}
# The consumer group the flushers read the outbox through.
OUTBOX_GROUP = "polar"
REPORT_INTERVAL = {{ outpost_constants.report_interval / 1000 }}
SPAN_SAMPLE_RATE = {{ outpost_constants.span_sample_rate }}
TELEMETRY_CAP = {{ outpost_constants.telemetry_cap }}
RELAY_LOCK_TTL = {{ outpost_constants.relay_lock_ttl / 1000 }}
POLL_INTERVAL = {{ outpost_constants.poll_interval / 1000 }}
REDIS_RECONNECT_DELAY = {{ outpost_constants.redis_reconnect_delay / 1000 }}
MAX_REDIS_RECONNECT_DELAY = {{ outpost_constants.max_redis_reconnect_delay / 1000 }}
PULL_INTERVAL = {{ outpost_constants.pull_interval / 1000 }}
PULL_LOCK_TTL = {{ outpost_constants.pull_lock_ttl / 1000 }}
PULL_RETRY_DELAY = {{ outpost_constants.pull_retry_delay / 1000 }}
MAX_PULL_RETRY_DELAY = {{ outpost_constants.max_pull_retry_delay / 1000 }}
PULL_LIMIT = {{ outpost_constants.pull_limit }}
PULL_CONCURRENCY = {{ outpost_constants.pull_concurrency }}
SNAPSHOT_BATCH = {{ outpost_constants.snapshot_batch }}
FETCH_BATCH_WINDOW = {{ outpost_constants.fetch_batch_window / 1000 }}
FETCH_CONCURRENCY = {{ outpost_constants.fetch_concurrency }}
FETCH_RETRY_DELAY = {{ outpost_constants.fetch_retry_delay / 1000 }}
PULL_CHECK_INTERVAL = {{ outpost_constants.pull_check_interval / 1000 }}
RELEASE_LOCK_SCRIPT = """
{{ outpost_scripts.release_lock }}"""

EXTEND_LOCK_SCRIPT = """
{{ outpost_scripts.extend_lock }}"""

OUTBOX_BACKLOG_SCRIPT = """
{{ outpost_scripts.outbox_backlog }}"""

READ_STATE_SCRIPT = """
{{ outpost_scripts.read_state }}"""

READ_STATES_SCRIPT = """
{{ outpost_scripts.read_states }}"""

READ_STATES_SHA = hashlib.sha1(READ_STATES_SCRIPT.encode()).hexdigest()

PREPARE_SNAPSHOT_SCRIPT = """
{{ outpost_scripts.prepare_snapshot }}"""

PREPARE_SNAPSHOT_SHA = hashlib.sha1(PREPARE_SNAPSHOT_SCRIPT.encode()).hexdigest()

PUSH_TELEMETRY_SCRIPT = """
{{ outpost_scripts.push_telemetry }}"""

PUSH_TELEMETRY_SHA = hashlib.sha1(PUSH_TELEMETRY_SCRIPT.encode()).hexdigest()

WRITE_BUCKET_SCRIPT = """
{{ outpost_scripts.write_bucket }}"""

WRITE_BUCKET_SHA = hashlib.sha1(WRITE_BUCKET_SCRIPT.encode()).hexdigest()

CONFIRM_SCRIPT = """
{{ outpost_scripts.confirm }}"""

APPLY_SNAPSHOT_SCRIPT = """
{{ outpost_scripts.apply_snapshot }}"""

COMMIT_PULL_SCRIPT = """
{{ outpost_scripts.commit_pull }}"""

BACKOFF_SCRIPT = """
{{ outpost_scripts.backoff }}"""


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


def _throttled(
    extend: collections.abc.Callable[[], collections.abc.Awaitable[None]], ttl: float
) -> collections.abc.Callable[[], collections.abc.Awaitable[None]]:
    """Extends a lock at most once per quarter of its time to live: it stays held, and a
    page of snapshots does not cost a command each."""
    extended = time.perf_counter()

    async def renew() -> None:
        nonlocal extended
        if time.perf_counter() - extended < ttl / 4:
            return
        extended = time.perf_counter()
        await extend()

    return renew


# The statistics a reducer's quantity adds up: all a read needs of its state.
def _statistics_of(reducer: Reducer) -> str:
    func = reducer["aggregation"]["func"]
    return "sum,count" if func == "avg" else func


@dataclasses.dataclass
class _Delivery:
    """The outbox entries a flusher delivered, and the slot it holds."""

    entries: list[str]
    lock_key: str
    token: str


def _confirm_arguments(
    prefix: str,
    hot_only: bool,
    groups: collections.abc.Mapping[tuple[str, int], list[str]],
    delivery: _Delivery | None = None,
) -> tuple[list[str], list[str | int]]:
    """The keys and arguments of one CONFIRM call settling every (identity, bucket)."""
    outbox = f"{prefix}:outbox"
    keys: list[str] = [outbox, delivery.lock_key if delivery else outbox]
    entries = delivery.entries if delivery else []
    args: list[str | int] = [
        "1" if hot_only else "",
        delivery.token if delivery else "",
        int(FLUSHER_LOCK_TTL * 1000),
        len(entries),
        *entries,
    ]
    for (identity, bucket_start), ids in groups.items():
        keys += [
            f"{prefix}:state:{identity}",
            f"{prefix}:pending:{identity}:{bucket_start}",
        ]
        args += [bucket_start, len(ids), *ids]
    return keys, args


# A customer's state for one reducer is None while Polar does not know the customer.
def _is_ready(state: ReducerState | None) -> bool:
    return state is None or state.cold_until is not None


log = get_logger(__name__)

# Called with each batch of events Polar accepted from the outbox.
OnDelivered = typing.Callable[[list[EventInput]], typing.Awaitable[None]]
# Called with each batch of events Polar refused, which leave the outbox.
OnDropped = typing.Callable[[list[EventInput], DropReason], typing.Awaitable[None]]


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
        client: httpx2.AsyncClient,
        telemetry: bool = True,
        snapshot_timeout: float = SNAPSHOT_TIMEOUT,
        confirm_timeout: float = CONFIRM_TIMEOUT,
        on_delivered: OnDelivered | None = None,
        on_dropped: OnDropped | None = None,
    ) -> None:
        self.redis_url = redis_url
        self._client = client
        self._on_delivered = on_delivered
        self._on_dropped = on_dropped
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
        self._failed_at = 0.0
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
        self._outbox_backlog: AsyncScript | None = None
        # One drain at a time per instance; a flush during one asks for one more round.
        self._draining: anyio.Event | None = None
        self._drain_again = False
        # This instance queued an event that no flusher was there to deliver: its next
        # flush drains.
        self._undrained = False
        validate_timeout(snapshot_timeout)
        self._snapshot_timeout = snapshot_timeout
        self._confirm_timeout = confirm_timeout
        # Snapshots and what they trigger run one at a time, in order.
        self._applying = anyio.Lock()
        self._pulled_at = 0.0
        self._pull_interval = PULL_INTERVAL
        self._pulling: anyio.Event | None = None
        self._relaying: anyio.Event | None = None
        self._flushing: dict[anyio.CancelScope, float] = {}
        self._pull_retry_at = 0.0
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
        cls,
        polar: PolarClient,
        redis_url: str,
        *,
        telemetry: bool = True,
        snapshot_timeout: float = SNAPSHOT_TIMEOUT,
        on_delivered: OnDelivered | None = None,
        on_dropped: OnDropped | None = None,
    ) -> typing.Self:
        return cls(
            redis_url=redis_url,
            client=polar._client._client,
            telemetry=telemetry,
            snapshot_timeout=snapshot_timeout,
            on_delivered=on_delivered,
            on_dropped=on_dropped,
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
            await self._create_outbox_group()
            self._apply_snapshot = self._redis.register_script(APPLY_SNAPSHOT_SCRIPT)
            self._confirm_script = self._redis.register_script(CONFIRM_SCRIPT)
            self._commit_pull = self._redis.register_script(COMMIT_PULL_SCRIPT)
            self._outbox_backlog = self._redis.register_script(OUTBOX_BACKLOG_SCRIPT)
            self._tasks = await self._stack.enter_async_context(
                anyio.create_task_group()
            )
            self._connection_id = str(uuid.uuid4())
            await self._load_pull()
            self._tasks.start_soon(self._pull_on_time)
            self._tasks.start_soon(self._report_on_time)
            self._tasks.start_soon(self._drain_on_time)
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
                self._outbox_backlog = None
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
                await self._in_flight()
                await self._drain_outbox_quietly()
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
            self._outbox_backlog = None
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
        self._require_running()
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
            # Polar dates the event as Outpost bucketed it.
            queued = _encode_event(
                {
                    **event,
                    "timestamp": event.get("timestamp") or parsed.timestamp.isoformat(),
                }
            )
            if not updates:
                await self._redis.xadd(self._outbox_key, {"event": queued})
                self._undrained = True
            writes: list[list[str | int | float]] = []
            for index, ((customer, reducer_id, bucket_start), statistics) in enumerate(
                updates.items()
            ):
                identity = f"{customer}:{reducer_id}"
                arguments: list[str | int | float] = [
                    f"{self._prefix}:state:{identity}",
                    f"{self._prefix}:pending:{identity}:{bucket_start}",
                    self._outbox_key,
                    f"{self._outbox_key}:flusher:0",
                    bucket_start,
                    statistics.count,
                    statistics.sum,
                    statistics.min if statistics.min is not None else "",
                    statistics.max if statistics.max is not None else "",
                    typing.cast(str, event["external_id"]),
                    queued if index == 0 else "",
                ]
                writes.append(arguments)
            # Most events match one reducer: one EVALSHA writes its bucket. A pipeline only
            # pays off for several writes, and closing it costs two extra event-loop turns.
            if len(writes) == 1:
                try:
                    results = [
                        await self._redis.evalsha(WRITE_BUCKET_SHA, 4, *writes[0])
                    ]
                except NoScriptError as error:
                    results = [error]
            else:
                async with self._redis.pipeline(transaction=False) as pipeline:
                    for arguments in writes:
                        pipeline.evalsha(WRITE_BUCKET_SHA, 4, *arguments)
                    results = await pipeline.execute(raise_on_error=False)
            first_error: Exception | None = None
            for index, (arguments, result) in enumerate(
                zip(writes, results, strict=True)
            ):
                # Redis caches the script with the first EVAL, so this happens once per server.
                if isinstance(result, NoScriptError):
                    try:
                        result = results[index] = await self._redis.eval(
                            WRITE_BUCKET_SCRIPT, 4, *arguments
                        )
                    except RedisError as error:
                        result = error
                if isinstance(result, Exception) and first_error is None:
                    first_error = result
            if first_error is not None:
                raise first_error
            if writes and results[0] == 2:
                self._undrained = True
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
        self._require_running()
        groups = self._settlements(events)
        assert self._confirm_script is not None
        if groups:
            await self._confirm_script(
                *_confirm_arguments(self._prefix, hot_only, groups)
            )

    def _settlements(
        self, events: collections.abc.Sequence[EventInput]
    ) -> dict[tuple[str, int], list[str]]:
        """The events' ids, by the (identity, bucket) whose pending usage they settle.
        An event another SDK queued in a form this one cannot parse settles nothing
        here: it stays pending until the snapshot that counts it."""
        groups: dict[tuple[str, int], list[str]] = {}
        for event in events:
            try:
                self.validate(event)
                parsed = self._parse_event(event)
            except (AttributeError, KeyError, PolarError, TypeError, ValueError):
                continue
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
        return groups

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
            self._require_running()
            await self._refresh()
            usage = self._find_reducer("usage", meter_id)
            if usage is None:
                read.outcome = "unknown_meter"
                raise UnknownMeterError(f"Outpost reduces no meter {meter_id}")
            credit = self._find_reducer("credit", meter_id)
            reducers = [usage] if credit is None else [usage, credit]
            states = await self._read(
                customer, reducers, [_statistics_of(reducer) for reducer in reducers]
            )
            state = states[0]
            credit_state = states[1] if credit is not None else None
            if state is None or (credit is not None and credit_state is None):
                read.outcome = "unknown_customer"
                return None
            # A balance without its credits would read as overdrawn.
            if state.cold_until is None or (
                credit_state is not None and credit_state.cold_until is None
            ):
                raise NotReadyError("Customer snapshot is not ready")
            read.outcome = "ready"
            consumed = consumed_units(state, usage["aggregation"]["func"])
            credited: int | float = 0
            if credit is not None and credit_state is not None:
                credited = consumed_units(credit_state, credit["aggregation"]["func"])
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
            self._require_running()
            await self._refresh()
            # Readiness alone: no statistic of any state.
            states = await self._read(
                customer, self._reducers, ["" for _ in self._reducers]
            )
            if not all(map(_is_ready, states)):
                read.outcome = "not_ready"
            elif None in states:
                read.outcome = "unknown_customer"
            else:
                read.outcome = "ready"

    async def flush(self, *, timeout: float = 30.0) -> None:
        """Deliver the events this instance queued, and wait for the pull and the fetches
        in flight: a serverless function must not freeze in the middle of them. A newer
        flush that outlasts this one releases it, since it waits for the same work."""
        deadline = anyio.current_time() + timeout
        for older, until in self._flushing.items():
            if until <= deadline:
                older.cancel()
        with anyio.CancelScope() as scope:
            self._flushing[scope] = deadline
            try:
                with anyio.fail_after(timeout):
                    await self._drain_outbox_quietly()
                await self._in_flight(max(0.0, deadline - anyio.current_time()))
            finally:
                del self._flushing[scope]

    async def _in_flight(self, timeout: float = 30.0) -> None:
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
        # A fleet that stops pulling keeps its newest exports only.
        arguments = [
            self._telemetry_key("spans"),
            self._telemetry_key("metrics"),
            TELEMETRY_CAP,
            len(spans),
            *spans,
            *metrics,
        ]
        try:
            try:
                await self._redis.evalsha(PUSH_TELEMETRY_SHA, 2, *arguments)
            except NoScriptError:
                # Redis caches the script with the first EVAL, so this happens once per server.
                await self._redis.eval(PUSH_TELEMETRY_SCRIPT, 2, *arguments)
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
        self, customer: str, reducers: list[Reducer], statistics: list[str]
    ) -> list[ReducerState | None]:
        """Reads the customer's states from Redis. One Polar has no snapshot of yet is
        asked for once, then read again once the fleet's fetch of it ends."""
        deadline = anyio.current_time() + self._snapshot_timeout
        states = await self._load(customer, reducers, statistics)
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
        markers = [
            self._fetch_key(f"{customer}:{reducer['id']}")
            for reducer, state in zip(reducers, states, strict=True)
            if not _is_ready(state)
        ]
        redis = self._require_redis()
        while True:
            fetching = await redis.exists(*markers)
            if not fetching or anyio.current_time() >= deadline:
                states = await self._load(customer, reducers, statistics)
                if all(map(_is_ready, states)) or anyio.current_time() >= deadline:
                    return states
            await anyio.sleep(min(POLL_INTERVAL, deadline - anyio.current_time()))

    async def _load(
        self, customer: str, reducers: list[Reducer], statistics: list[str]
    ) -> list[ReducerState | None]:
        """One command: each reducer's state, with only the statistics the read adds
        up, unless Polar does not know the customer."""
        redis = self._require_running()
        keys = [self._pull_key]
        for reducer in reducers:
            identity = f"{customer}:{reducer['id']}"
            keys[-1:-1] = [
                f"{self._prefix}:state:{identity}",
                self._missing_key(identity),
            ]
        try:
            results = await redis.evalsha(READ_STATES_SHA, len(keys), *keys, *statistics)
        except NoScriptError:
            # Redis caches the script with the first EVAL, so this happens once per server.
            results = await redis.eval(READ_STATES_SCRIPT, len(keys), *keys, *statistics)
        resets = results.pop()
        self._resets = None if resets is None else int(resets)
        now = time.time() * 1000
        return [
            None if retry_at and float(retry_at) > now else decode_state(state)
            for retry_at, state in results
        ]

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
        except (TimeoutError, NotReadyError, UnknownMeterError):
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

    def _require_running(self) -> Redis:
        """What the merchant calls fails while the instance is stopped. The pull goes
        on behind it, at its backoff: one that succeeds ends the failure."""
        if self._failure is not None:
            if self._tasks is not None:
                self._tasks.start_soon(self._refresh_quietly)
            raise self._failure
        return self._require_redis()

    def _pulled(self, at: float) -> None:
        """A pull that succeeded since the failure, on this instance or another, ends
        it."""
        self._pulled_at = at
        if self._failure is not None and at > self._failed_at:
            self._failure = None

    def _require_redis(self) -> Redis:
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
                        self._fetch_key(identity),
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

    async def _create_outbox_group(self) -> None:
        """A flusher reads the outbox through the group, which tracks each batch until
        Polar has it."""
        try:
            await self._require_redis().xgroup_create(
                self._outbox_key, OUTBOX_GROUP, id="0", mkstream=True
            )
        except RedisResponseError as error:
            if "BUSYGROUP" not in str(error):
                raise

    async def _drain_outbox_quietly(self) -> None:
        """Redis keeps what a drain fails to deliver: the next flush takes it. Without an
        event of its own to deliver, a flush waits for the drain in flight, if any."""
        if self._redis is None or self._failure is not None:
            return
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
        except* Exception:  # noqa: BLE001
            self._undrained = True
        finally:
            self._draining = None
            done.set()

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
                length, delivering, retry_at = await self._outbox_backlog(
                    keys=[self._outbox_key, self._outbox_backoff_key],
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
        lock_key = f"{self._outbox_key}:flusher:{slot}"
        consumer = f"flusher-{slot}"
        token = uuid.uuid4().hex
        if not await redis.set(
            lock_key, token, px=int(FLUSHER_LOCK_TTL * 1000), nx=True
        ):
            return "busy"
        try:
            if slot == 0:
                await redis.xautoclaim(
                    self._outbox_key,
                    OUTBOX_GROUP,
                    consumer,
                    int(OUTBOX_CLAIM_IDLE * 1000),
                    count=OUTBOX_BATCH,
                    justid=True,
                )
            start = "0"
            while True:
                if start == ">":
                    assert self._outbox_backlog is not None
                    length, delivering, _ = await self._outbox_backlog(
                        keys=[self._outbox_key, self._outbox_backoff_key],
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
                        {self._outbox_key: start},
                        count=OUTBOX_BATCH,
                    ),
                )
                entries = read[0][1] if read else []
                if entries:
                    delivery = _Delivery(
                        [_decode(entry) for entry, _ in entries], lock_key, token
                    )
                    if not await self._deliver(entries, delivery):
                        return "failed"
                elif start == "0":
                    start = ">"
        finally:
            # Past its TTL, the slot may be another flusher's.
            with contextlib.suppress(RedisError):
                await redis.eval(RELEASE_LOCK_SCRIPT, 1, lock_key, token)

    async def _back_off_outbox(self, wait: float | None) -> None:
        """As long as Polar asks, or longer after each failure in a row."""
        await self._back_off(
            self._outbox_backoff_key,
            first=wait if wait is not None else OUTBOX_RETRY_DELAY,
            maximum=wait if wait is not None else MAX_OUTBOX_RETRY_DELAY,
        )

    async def _deliver(
        self, entries: list[typing.Any], delivery: _Delivery
    ) -> bool:
        """Sends a batch to Polar, then acknowledges it and settles its events in one
        script. Polar refusing the batch drops it; failing to take it leaves it for the
        next flush."""
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
                log.warning("Outpost dropped an outbox entry it cannot read")
        dropped = False
        if events:
            try:
                response = await self._client.post(
                    "/v1/events/ingest", json={"events": events}, timeout=TIMEOUT
                )
            except httpx2.TransportError:
                await self._back_off_outbox(None)
                return False
            # Only a 2xx means Polar has the batch; a 4xx other than a refusal or a rate
            # limit drops it; anything else leaves it for the next flush.
            dropped = response.is_client_error and response.status_code not in (
                401,
                403,
                429,
            )
            if not response.is_success and not dropped:
                retry_after = response.headers.get("Retry-After")
                await self._back_off_outbox(
                    retry_after_seconds(int(retry_after))
                    if response.status_code == 429
                    and retry_after
                    and retry_after.isdecimal()
                    else None
                )
                return False
        assert self._confirm_script is not None
        await self._confirm_script(
            *_confirm_arguments(
                self._prefix, not dropped, self._settlements(events), delivery
            )
        )
        try:
            if dropped:
                if self._on_dropped is not None:
                    await self._on_dropped(events, "permanent_error")
            elif events and self._on_delivered is not None:
                await self._on_delivered(events)
        except Exception as error:  # noqa: BLE001
            log.warning(
                "Outpost %s failed: %s",
                "on_dropped" if dropped else "on_delivered",
                error,
            )
        return True

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
        # Its clock starts with the batch: a slow fetch does not push back the first extension.
        renewed = _throttled(renew, TIMEOUT)
        try:
            requested = []
            for identity in identities:
                customer, reducer_id = identity.rsplit(":", 1)
                requested.append(
                    {**self._customer_arguments(customer), "reducer_id": reducer_id}
                )
            resets = self._resets
            deadline = anyio.current_time() + self._snapshot_timeout

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
                    except (httpx2.HTTPStatusError, httpx2.TransportError) as error:
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
                        await renewed()

            async with self._applying, anyio.create_task_group() as group:
                for snapshot in snapshots:
                    group.start_soon(apply, snapshot)
        finally:
            with contextlib.suppress(RedisError):
                await redis.delete(
                    *(self._fetch_key(identity) for identity in identities)
                )

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
            await self.flush_telemetry()

    async def _drain_on_time(self) -> None:
        """A long-running process delivers what it queued without a flush."""
        while True:
            await anyio.sleep(DRAIN_INTERVAL)
            if self._undrained:
                await self._drain_outbox_quietly()

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

    async def _request(self, method: str, path: str, **kwargs: typing.Any) -> typing.Any:
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

    # The events Polar has yet to receive, in the order Outpost tracked them.
    @property
    def _outbox_key(self) -> str:
        return f"{self._prefix}:outbox"

    @property
    def _outbox_backoff_key(self) -> str:
        return f"{self._outbox_key}:backoff"

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
        most snapshot_timeout, once Redis may be stale, unless the last pull failed."""
        if not self._pull_due():
            return
        await self._load_pull()
        if not self._pull_due():
            return
        stale = (
            time.time() - self._pulled_at >= 2 * self._pull_interval
            and not self._pull_retry_at
        )
        pulling = self._start_pull(wait=stale)
        if stale:
            with anyio.move_on_after(self._snapshot_timeout):
                await pulling.wait()

    def _pull_due(self) -> bool:
        now = time.time()
        return now - self._pulled_at >= self._pull_interval and now >= self._pull_retry_at

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
        if configured != self._configuration_revision and await self._configure("redis"):
            self._configuration_revision = configured
        self._pulled(float(pulled_at) / 1000 if pulled_at else 0.0)
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

    def _start_pull(self, *, wait: bool = True) -> anyio.Event:
        """`wait`: a read needs the pull's snapshots, and waits for another instance's
        pull to end."""
        if self._pulling is None:
            assert self._tasks is not None
            self._pulling = anyio.Event()
            self._tasks.start_soon(self._run_pull, self._pulling, wait)
        return self._pulling

    async def _pull_on_time(self) -> None:
        """A long-running process pulls on time, reads or not."""
        while True:
            await anyio.sleep(PULL_CHECK_INTERVAL)
            await self._refresh_quietly()

    async def _refresh_quietly(self) -> None:
        with contextlib.suppress(RedisError):
            await self._refresh()

    async def _run_pull(self, done: anyio.Event, wait: bool) -> None:
        try:
            with self._span("outpost.pull") as span:
                await self._pull_changes(span, wait)
        except Exception as error:  # noqa: BLE001
            # Polar or Redis failed: the next pull starts again from the same cursor, later.
            self._pull_retry_at = await self._back_off(self._pull_key)
            self._fail_unless_transient(error)
        finally:
            self._pulling = None
            done.set()

    async def _back_off(
        self,
        key: str,
        *forget: int,
        first: float = PULL_RETRY_DELAY,
        maximum: float = MAX_PULL_RETRY_DELAY,
    ) -> float:
        """One more failure on the key, for the whole fleet: when to try again."""
        now = int(time.time() * 1000)
        retry_at = now + int(first * 1000)
        if self._redis is not None:
            with contextlib.suppress(RedisError):
                retry_at = await self._redis.eval(
                    BACKOFF_SCRIPT,
                    1,
                    key,
                    now,
                    int(first * 1000),
                    int(maximum * 1000),
                    *forget,
                )
        return retry_at / 1000

    def _fetch_key(self, identity: str) -> str:
        return f"{self._prefix}:fetch:{identity}"

    def _missing_key(self, identity: str) -> str:
        return f"{self._prefix}:missing:{identity}"

    async def _pull_changes(self, span: Span, wait: bool) -> None:
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
            # Unless a read needs it, this instance does not wait for the other one's pull:
            # it checks the pull again once a pull check has passed.
            if wait:
                await self._wait_for_pull()
            else:
                self._pulled_at = time.time() - self._pull_interval + PULL_CHECK_INTERVAL
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

        renewed = _throttled(renew, PULL_LOCK_TTL)
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
                except httpx2.HTTPStatusError as error:
                    # Only a rate limit clears on its own: any other 4xx would repeat forever.
                    if error.response.is_client_error and error.response.status_code != 429:
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
                            # A confirm waits on Polar: the lock is extended before
                            # each one.
                            if await self._receive_snapshot(
                                snapshot, pulled=True, resets=resets, renew=renew
                            ):
                                applied += 1
                                await renewed()

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
                    self._pulled(now / 1000)
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
            # Telemetry is best effort: no failure of it stops Outpost. The instance that
            # pulled measures the shared Redis for the fleet.
            with contextlib.suppress(Exception):
                await self._report_redis_size()
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
        self._failed_at = time.time()

    async def _receive_snapshot(
        self,
        snapshot: Snapshot,
        *,
        pulled: bool,
        resets: int | None,
        renew: collections.abc.Callable[[], collections.abc.Awaitable[None]] | None = None,
    ) -> bool:
        """Applies Polar's snapshot, unless pulled for a customer nobody here reads.
        `resets` is the reset count when asked: after another reset, reads ask again."""
        if not any(reducer["id"] == snapshot["reducer_id"] for reducer in self._reducers):
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
        key = f"{self._prefix}:state:{identity}"
        redis = self._require_redis()
        if not snapshot["customer_exists"]:
            # A pulled snapshot of a customer nobody here reads or writes has no state in
            # Redis.
            if pulled and not await redis.exists(key):
                return False
            # The fleet asks again later, longer after each miss, and forgets the misses past
            # the longest wait.
            await self._back_off(
                self._missing_key(identity), int(2 * MAX_PULL_RETRY_DELAY * 1000)
            )
            return False
        statistics = [snapshot["count"], snapshot["sum"], snapshot["min"], snapshot["max"]]
        if any(
            isinstance(value, float) and not math.isfinite(value) for value in statistics
        ):
            raise ValueError("Snapshot values must be finite")
        arguments = (
            key,
            self._missing_key(identity),
            "1" if pulled else "",
            snapshot["cold_until"],
        )
        try:
            sealed = await redis.evalsha(PREPARE_SNAPSHOT_SHA, 2, *arguments)
        except NoScriptError:
            # Redis caches the script with the first EVAL, so this happens once per server.
            sealed = await redis.eval(PREPARE_SNAPSHOT_SCRIPT, 2, *arguments)
        if sealed is None:
            return False
        confirmation, answered = await self._ask_confirmation(
            identity, customer, snapshot, [int(start) for start in sealed], renew
        )
        await self._apply_snapshot_now(
            identity,
            customer,
            confirmation.snapshot if confirmation is not None else snapshot,
            confirmation,
            answered=answered,
            # Polar did not say which pending events the snapshot counts: no reset
            # count matches, so the state asks again at its next read.
            resets=UNCONFIRMED if confirmation is not None and not answered else resets,
        )
        return True

    async def _ask_confirmation(
        self,
        identity: str,
        customer: str,
        snapshot: Snapshot,
        sealed: list[int],
        renew: collections.abc.Callable[[], collections.abc.Awaitable[None]] | None = None,
    ) -> tuple[_Confirmation | None, bool]:
        """Asks Polar which of the pending events in the `sealed` buckets, those the
        snapshot seals that hold pending events, it counts. A request that fails leaves its
        events pending until a later snapshot."""
        started = time.perf_counter()
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
                except (httpx2.HTTPError, TimeoutError):
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
                    keys, args = _confirm_arguments(
                        self._prefix,
                        False,
                        {
                            (identity, bucket_start): ids
                            for bucket_start, ids in confirmed.items()
                        },
                    )
                    await self._confirm_script(keys=keys, args=args, client=pipeline)
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
