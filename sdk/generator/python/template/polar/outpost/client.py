import collections
import collections.abc
import contextlib
import dataclasses
import datetime
import functools
import hashlib
import json
import math
import random
import time
import types
import typing
import uuid

import anyio
import httpx
from httpx_ws import (
    AsyncWebSocketSession,
    HTTPXWSException,
    WebSocketUpgradeError,
    aconnect_ws,
)
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
from redis.exceptions import TimeoutError as RedisTimeoutError

from polar.base import PolarError
from polar.metering.client import PolarClient
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


def _report_local_value(
    span: Span, snapshot: "Snapshot", replaced: collections.abc.Sequence[str | bytes]
) -> None:
    decoded = [
        value.decode() if isinstance(value, bytes) else value for value in replaced
    ]
    fields = dict(zip(decoded[::2], decoded[1::2], strict=True))
    if "cold_until" not in fields:
        return
    previous = int(fields["cold_until"])
    local = BucketStatistics()
    buckets: dict[str, BucketStatistics] = {}
    pending: dict[str, BucketStatistics] = {}
    for field, value in fields.items():
        if field.startswith("cold:"):
            setattr(local, field.removeprefix("cold:"), _number(value))
            continue
        kind, _, rest = field.partition(":")
        if kind not in ("bucket", "pending"):
            continue
        start, _, statistic = rest.partition(":")
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


def _backoff_delay(attempt: int, base: float, cap: float) -> float:
    # Bounded exponent: a long outage would overflow the float otherwise.
    delay = min(cap, base * 2 ** min(attempt - 1, 16))
    return random.uniform(delay / 2, delay)


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
            HTTPXWSException,
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
        socket_timeout=REDIS_TIMEOUT,
        socket_connect_timeout=REDIS_TIMEOUT,
    ) as redis:
        await redis.ping()
        yield redis


@contextlib.asynccontextmanager
async def connect_websocket(
    client: httpx.AsyncClient,
) -> collections.abc.AsyncGenerator[AsyncWebSocketSession, None]:
    async with aconnect_ws(
        str(client.base_url.join("/v1/outpost/")), client
    ) as websocket:
        yield websocket


# Every key and the channel carry the layout version. A new layout takes a new version, starts
# cold from Polar's snapshot and never reads the previous keys.
KEY_VERSION = "outpost:v1"
CACHE_SIZE = 1024
REDIS_TIMEOUT = 5.0
REDIS_RECONNECT_DELAY = 0.1
MAX_REDIS_RECONNECT_DELAY = 2.0
SYNC_INTERVAL = 30.0
RECONNECT_DELAY = 0.5
SNAPSHOT_TIMEOUT = 5.0
CONFIRM_TIMEOUT = 2.0
# Pending ids per confirm request: Polar refuses a bigger one.
CONFIRM_BATCH = 1000
MAX_RECONNECT_DELAY = 30.0

READ_STATE_SCRIPT = """
{{ outpost_scripts.read_state }}"""

WRITE_BUCKET_SCRIPT = """
{{ outpost_scripts.write_bucket }}"""

WRITE_BUCKET_SHA = hashlib.sha1(WRITE_BUCKET_SCRIPT.encode()).hexdigest()

CONFIRM_SCRIPT = """
{{ outpost_scripts.confirm }}"""

CONFIRM_SHA = hashlib.sha1(CONFIRM_SCRIPT.encode()).hexdigest()

APPLY_SNAPSHOT_SCRIPT = """
{{ outpost_scripts.apply_snapshot }}"""


class StateUpdate(typing.TypedDict):
    customer: str
    state: typing.NotRequired[list[str]]
    bucket: typing.NotRequired[list[str]]


@dataclasses.dataclass
class ReducerState:
    epoch: str
    revision: int
    cold_until: int | None
    cold: BucketStatistics
    buckets: dict[int, BucketStatistics]
    # The part of each bucket Polar has not confirmed yet.
    pending: dict[int, BucketStatistics]
    credited: dict[str, int | float]


def decode_state(values: collections.abc.Sequence[str | bytes]) -> ReducerState:
    decoded = [
        value.decode() if isinstance(value, bytes) else value for value in values
    ]
    epoch = ""
    revision = 0
    cold_until: int | None = None
    cold = BucketStatistics()
    buckets: dict[int, BucketStatistics] = {}
    pending: dict[int, BucketStatistics] = {}
    credited: dict[str, int | float] = {}
    for field, value in zip(decoded[::2], decoded[1::2], strict=True):
        if field.startswith(("bucket:", "pending:")):
            prefix, _, rest = field.partition(":")
            timestamp, _, statistic = rest.partition(":")
            statistics = buckets if prefix == "bucket" else pending
            start = int(timestamp)
            bucket = statistics.get(start)
            if bucket is None:
                bucket = statistics[start] = BucketStatistics()
            setattr(bucket, statistic, _number(value))
        elif field.startswith("cold:"):
            setattr(cold, field.removeprefix("cold:"), _number(value))
        elif field.startswith("credited:"):
            credited[field[9:]] = _number(value)
        elif field == "epoch":
            epoch = value
        elif field == "revision":
            revision = int(value)
        elif field == "cold_until":
            cold_until = int(value)
    return ReducerState(
        epoch=epoch,
        revision=revision,
        cold_until=cold_until,
        cold=cold,
        buckets=buckets,
        pending=pending,
        credited=credited,
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
    missing: bool = False
    changed: anyio.Event = dataclasses.field(default_factory=anyio.Event)

    def is_ready(self, meter_ids: collections.abc.Iterable[str]) -> bool:
        state = self.state
        return self.missing or (
            state is not None
            and state.cold_until is not None
            and all(meter_id in state.credited for meter_id in meter_ids)
        )

    def notify(self) -> None:
        self.changed.set()
        self.changed = anyio.Event()


class Configuration(typing.TypedDict):
    reducers: list[Reducer]


class Snapshot(typing.TypedDict):
    customer_id: str | None
    external_customer_id: str | None
    customer_exists: bool
    meter_id: str
    version: int
    cold_until: int
    count: int
    sum: int | float
    min: int | float | None
    max: int | float | None
    credited_units: int | float


@dataclasses.dataclass
class IngestResult:
    inserted: int
    duplicates: int = 0


# A snapshot waiting for Polar to say which of the pending events it counts, one per meter.
@dataclasses.dataclass
class _Confirmation:
    key: str
    snapshot: "Snapshot"
    customer: str
    identity: str
    started: float
    age: float
    superseded: bool
    awaited: int = 0
    messages: int = 0
    asked: int = 0
    confirmed: dict[int, list[str]] = dataclasses.field(default_factory=dict)
    timer: anyio.CancelScope | None = None


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
        self._websocket: AsyncWebSocketSession | None = None
        self._connection_id: str | None = None
        self._failure: PolarOutpostError | None = None
        self._reconnect_attempts = 0
        self._tasks: anyio.abc.TaskGroup | None = None
        self._reducers: list[Reducer] = []
        self._matchers: list[ReducerMatcher] = []
        self._actors: set[str] = set()
        self._configured = anyio.Event()
        self._apply_snapshot: AsyncScript | None = None
        self._confirm_script: AsyncScript | None = None
        self._confirm_timeout = confirm_timeout
        self._confirmations: dict[str, _Confirmation] = {}
        self._read_state: AsyncScript | None = None
        self._cache: collections.OrderedDict[str, LocalState] = (
            collections.OrderedDict()
        )
        self._synced = anyio.Event()
        self._redis_available = False
        self._channel = ""
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
            self._channel = f"{KEY_VERSION}:{self._redis.connection_pool.connection_kwargs.get('db', 0)}:updates"
            self._read_state = self._redis.register_script(READ_STATE_SCRIPT)
            self._apply_snapshot = self._redis.register_script(APPLY_SNAPSHOT_SCRIPT)
            self._confirm_script = self._redis.register_script(CONFIRM_SCRIPT)
            self._tasks = await self._stack.enter_async_context(
                anyio.create_task_group()
            )
            await self._tasks.start(self._run_websocket)
            with anyio.fail_after(5):
                await self._tasks.start(self._listen_redis)
        except BaseException:
            try:
                if self._tasks is not None:
                    self._tasks.cancel_scope.cancel()
                await self._stack.aclose()
            finally:
                self._redis = None
                self._websocket = None
                self._connection_id = None
                self._tasks = None
                self._reducers = []
                self._matchers = []
                self._apply_snapshot = None
                self._confirm_script = None
                self._confirmations.clear()
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
        with self._span("outpost.websocket.disconnect"):
            pass
        with self._span("outpost.redis.disconnect"):
            pass
        try:
            if self._tasks is not None:
                self._tasks.cancel_scope.cancel()
            await self._stack.__aexit__(exc_type, exc_val, exc_tb)
        finally:
            self._redis = None
            self._websocket = None
            self._connection_id = None
            self._tasks = None
            self._reducers = []
            self._matchers = []
            self._actors.clear()
            self._apply_snapshot = None
            self._confirm_script = None
            self._confirmations.clear()
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
            and self._websocket is not None
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
            if not self._configured.is_set():
                with anyio.fail_after(5):
                    await self._configured.wait()
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
                    f"{KEY_VERSION}:state:{identity}",
                    f"{KEY_VERSION}:pending:{identity}:{bucket_start}",
                    identity,
                    self._channel,
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
        if not self._configured.is_set():
            with anyio.fail_after(5):
                await self._configured.wait()
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
                    f"{KEY_VERSION}:state:{identity}",
                    f"{KEY_VERSION}:pending:{identity}:{bucket_start}",
                    identity,
                    self._channel,
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
            if not self._configured.is_set():
                with anyio.fail_after(5):
                    await self._configured.wait()
            reducers = self._reducers
            reducer = next(
                (
                    reducer
                    for reducer in reducers
                    if meter_id in reducer.get("meter_ids", [])
                ),
                None,
            )
            if reducer is None:
                read.outcome = "unknown_meter"
                return None
            local = await self._warm_customer(customer, reducer)
            if not local.is_ready([meter_id]):
                with anyio.move_on_after(SNAPSHOT_TIMEOUT):
                    await self._wait_ready(reducer, local, [meter_id])
            if local.missing:
                read.outcome = "unknown_customer"
                return None
            state = local.state
            if state is None or state.cold_until is None:
                raise _NotReadyError("Customer snapshot is not ready")
            read.outcome = (
                "ready"
                if reducer["aggregation"]["func"] == "unique"
                or meter_id in state.credited
                else "not_ready"
            )
            consumed = consumed_units(state, reducer["aggregation"]["func"])
            credited = state.credited.get(meter_id, 0)
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
            warmed = await self._warm_actor(customer)
            if not all(
                local.is_ready(reducer.get("meter_ids", []))
                for reducer, local in warmed
            ):
                with anyio.move_on_after(SNAPSHOT_TIMEOUT):
                    for reducer, local in warmed:
                        await self._wait_ready(
                            reducer, local, reducer.get("meter_ids", [])
                        )
            # Polar sends no snapshot for unique reducers.
            snapshotted = [
                (reducer, local)
                for reducer, local in warmed
                if reducer["aggregation"]["func"] != "unique"
            ]
            if not all(
                local.is_ready(reducer.get("meter_ids", []))
                for reducer, local in snapshotted
            ):
                read.outcome = "not_ready"
            elif any(local.missing for _, local in snapshotted):
                read.outcome = "unknown_customer"
            else:
                read.outcome = "ready"

    async def flush_telemetry(self) -> bool:
        tracer_provider = self._tracer_provider
        meter_provider = self._meter_provider
        if tracer_provider is None or meter_provider is None:
            return True
        self._report_sync()
        flushed = await anyio.to_thread.run_sync(tracer_provider.force_flush)
        return await anyio.to_thread.run_sync(meter_provider.force_flush) and flushed

    async def _warm_actor(self, customer: str) -> list[tuple[Reducer, LocalState]]:
        if not self._configured.is_set():
            with anyio.fail_after(5):
                await self._configured.wait()
        return [
            (reducer, await self._warm_customer(customer, reducer))
            for reducer in self._reducers
        ]

    async def _wait_ready(
        self, reducer: Reducer, local: LocalState, meter_ids: list[str]
    ) -> None:
        # Polar sends no snapshot for unique reducers, nor without a connection.
        if reducer["aggregation"]["func"] == "unique" or not self.connected:
            return
        while not local.is_ready(meter_ids):
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
        except (TimeoutError, _NotReadyError):
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
            with anyio.move_on_after(REDIS_TIMEOUT):
                await self._synced.wait()
            if not self._synced.is_set():
                raise UnavailableRedisError()
        local = self._cache.get(identity)
        if local is None:
            local = LocalState()
            self._cache[identity] = local
            if len(self._cache) > CACHE_SIZE:
                evicted, _ = self._cache.popitem(last=False)
                self._actors.discard(evicted)
        self._cache.move_to_end(identity)
        if local.state is not None and identity in self._actors:
            return local
        async with local.lock:
            if local.state is None:
                local.state = await self._load_state(identity)
                local.notify()
            websocket = self._websocket
            if identity not in self._actors and websocket is not None:
                try:
                    for meter_id in reducer.get("meter_ids", []):
                        await websocket.send_json(
                            {
                                "type": "meter_usage",
                                "payload": {
                                    **self._customer_arguments(customer),
                                    "meter_id": meter_id,
                                },
                            }
                        )
                except HTTPXWSException:
                    # Requested again once reconnected.
                    return local
                self._actors.add(identity)
        return local

    async def _load_state(self, customer: str) -> ReducerState:
        assert self._read_state is not None
        epoch = _generate_epoch()
        state = await self._read_state(
            keys=[f"{KEY_VERSION}:state:{customer}"],
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
                    await pubsub.subscribe(self._channel)
                    subscribed = await pubsub.get_message(timeout=5)
                    if subscribed is None or subscribed["type"] != "subscribe":
                        raise RedisTimeoutError(
                            "Outpost subscription was not acknowledged"
                        )
                    self._redis_available = True
                    await self._refresh_states()
                    self._synced.set()
                if not started:
                    task_status.started()
                    started = True
                next_refresh = anyio.current_time() + SYNC_INTERVAL
                while True:
                    message = await pubsub.get_message(
                        ignore_subscribe_messages=True, timeout=1
                    )
                    if message is not None:
                        await self._receive_redis(message["data"])
                    if anyio.current_time() >= next_refresh:
                        self._report_sync()
                        assert self._tasks is not None
                        self._tasks.start_soon(self._report_redis_size)
                        await self._refresh_states()
                        next_refresh = anyio.current_time() + SYNC_INTERVAL

        async def disconnect(error: Exception) -> None:
            with self._span("outpost.redis.disconnect") as span:
                span.record_exception(error)
                span.set_status(StatusCode.ERROR)
            # Wake the reads waiting on a resync that just failed.
            stale, self._synced = self._synced, anyio.Event()
            stale.set()
            self._redis_available = False
            for local in self._cache.values():
                local.state = None

        # the failure count never resets, so after earlier outages
        # the first retry waits up to the 2s cap instead of the base delay.
        await Retry(RedisReconnectBackoff(), -1).call_with_retry(listen, disconnect)

    async def _run_websocket(
        self,
        *,
        task_status: anyio.abc.TaskStatus[None] = anyio.TASK_STATUS_IGNORED,
    ) -> None:
        started = False
        self._reconnect_attempts = 0
        while True:
            attempt = self._reconnect_attempts
            try:
                async with contextlib.AsyncExitStack() as stack:
                    with self._span(
                        "outpost.websocket.connect",
                        **({"outpost.reconnect.attempt": attempt} if attempt else {}),
                    ):
                        websocket = await stack.enter_async_context(
                            connect_websocket(self._client)
                        )
                    self._websocket = websocket
                    self._actors.clear()
                    await websocket.send_json({"type": "configuration"})
                    if not started:
                        task_status.started()
                        started = True
                    await self._listen_websocket(websocket)
            except Exception as error:
                if not started:
                    raise
                refused = isinstance(
                    error, WebSocketUpgradeError
                ) and error.response.status_code in (401, 403)
                if refused or not _is_connection_error(error):
                    self._failure = PolarOutpostError(
                        "Polar refused the Outpost connection"
                        if refused
                        else "Outpost stopped"
                    )
                    self._failure.__cause__ = error
                    return
            finally:
                self._websocket = None
                self._connection_id = None
            self._reconnect_attempts += 1
            await anyio.sleep(
                _backoff_delay(
                    self._reconnect_attempts, RECONNECT_DELAY, MAX_RECONNECT_DELAY
                )
            )

    async def _listen_websocket(self, websocket: AsyncWebSocketSession) -> None:
        while True:
            try:
                message = await websocket.receive_json()
            except Exception:
                with self._span("outpost.websocket.disconnect"):
                    raise
            if message["type"] == "connection":
                self._connection_id = message["payload"]["id"]
            elif message["type"] == "configuration":
                self._reducers = message["payload"]["reducers"]
                self._matchers = with_matchers(self._reducers)
                self._configured.set()
                # A session counts as stable once Polar configured it.
                self._reconnect_attempts = 0
            elif message["type"] == "meter_usage":
                snapshot: Snapshot = message["payload"]
                reducer = next(
                    (
                        reducer
                        for reducer in self._reducers
                        if snapshot["meter_id"] in reducer.get("meter_ids", [])
                    ),
                    None,
                )
                if reducer is None:
                    continue
                if (
                    snapshot["customer_id"] is not None
                    and snapshot["external_customer_id"] is not None
                ):
                    continue
                customer = self._customer_key(
                    snapshot["customer_id"], snapshot["external_customer_id"]
                )
                identity = f"{customer}:{reducer['id']}"
                local = self._cache.get(identity)
                if local is not None:
                    local.missing = not snapshot["customer_exists"]
                    local.notify()
                if not snapshot["customer_exists"]:
                    # Asked again on the next read, in case it was created since.
                    self._actors.discard(identity)
                    continue
                statistics = [
                    snapshot["count"],
                    snapshot["sum"],
                    snapshot["min"],
                    snapshot["max"],
                    snapshot["credited_units"],
                ]
                if any(
                    isinstance(value, float) and not math.isfinite(value)
                    for value in statistics
                ):
                    raise ValueError("Snapshot values must be finite")
                if not await self._ask_confirmation(
                    websocket, identity, customer, snapshot
                ):
                    await self._apply_snapshot_now(identity, customer, snapshot)
            elif message["type"] == "confirmed":
                payload = message["payload"]
                customer = self._customer_key(
                    payload["customer_id"], payload["external_customer_id"]
                )
                confirmation = self._confirmations.get(
                    f"{customer}:{payload['reducer_id']}:{payload['snapshot']['meter_id']}"
                )
                if confirmation is None:
                    continue
                confirmation.confirmed.setdefault(payload["bucket_start"], []).extend(
                    payload["ids"]
                )
                if payload["snapshot"]["version"] >= confirmation.snapshot["version"]:
                    confirmation.snapshot = payload["snapshot"]
                confirmation.awaited -= 1
                if confirmation.awaited == 0:
                    await self._settle_confirmation(confirmation, answered=True)

    async def _ask_confirmation(
        self,
        websocket: AsyncWebSocketSession,
        identity: str,
        customer: str,
        snapshot: Snapshot,
    ) -> bool:
        """Asks Polar which of the pending events in the buckets the snapshot seals it
        counts. The snapshot Polar answers with applies once it did, or the asking one
        after confirm_timeout with the events still pending."""
        started = time.perf_counter()
        key = f"{identity}:{snapshot['meter_id']}"
        superseded = self._confirmations.pop(key, None)
        if superseded is not None and superseded.timer is not None:
            superseded.timer.cancel()
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
            return False
        confirmation = _Confirmation(
            key,
            snapshot,
            customer,
            identity,
            started=started,
            # Seconds since the oldest bucket asked ended.
            age=(time.time_ns() / 1_000 - min(sealed) - BUCKET_SIZE) / 1_000_000,
            superseded=superseded is not None,
        )
        reducer_id = identity[len(customer) + 1 :]
        assert self._redis is not None
        for bucket_start in sealed:
            ids = await self._redis.hkeys(
                f"{KEY_VERSION}:pending:{identity}:{bucket_start}"
            )
            for offset in range(0, len(ids), CONFIRM_BATCH):
                batch = [
                    external_id.decode()
                    if isinstance(external_id, bytes)
                    else external_id
                    for external_id in ids[offset : offset + CONFIRM_BATCH]
                ]
                try:
                    await websocket.send_json(
                        {
                            "type": "confirm",
                            "payload": {
                                "reducer_id": reducer_id,
                                **self._customer_arguments(customer),
                                "bucket_start": bucket_start,
                                "meter_id": snapshot["meter_id"],
                                "ids": batch,
                            },
                        }
                    )
                except HTTPXWSException:
                    # Not connected: the events stay pending until the next snapshot.
                    return False
                confirmation.awaited += 1
                confirmation.messages += 1
                confirmation.asked += len(batch)
        if not confirmation.awaited:
            return False
        self._confirmations[key] = confirmation
        assert self._tasks is not None
        self._tasks.start_soon(self._expire_confirmation, confirmation)
        return True

    async def _expire_confirmation(self, confirmation: _Confirmation) -> None:
        with anyio.CancelScope() as timer:
            confirmation.timer = timer
            await anyio.sleep(self._confirm_timeout)
        if not timer.cancel_called:
            await self._settle_confirmation(confirmation, answered=False)

    async def _settle_confirmation(
        self, confirmation: _Confirmation, *, answered: bool
    ) -> None:
        if self._confirmations.get(confirmation.key) is not confirmation:
            return
        del self._confirmations[confirmation.key]
        if confirmation.timer is not None:
            confirmation.timer.cancel()
        await self._apply_snapshot_now(
            confirmation.identity,
            confirmation.customer,
            confirmation.snapshot,
            confirmation,
            answered=answered,
        )

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
        key = f"{KEY_VERSION}:state:{identity}"
        snapshot_arguments: list[str | int | float] = [
            identity,
            self._channel,
            _generate_epoch(),
            snapshot["cold_until"],
            snapshot["version"],
            snapshot["meter_id"],
            snapshot["credited_units"],
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
                "outpost.meter_id": snapshot["meter_id"],
                "outpost.snapshot_version": snapshot["version"],
            },
        ) as span:
            if confirmed:
                async with self._redis.pipeline(transaction=True) as pipeline:
                    for bucket_start, ids in confirmed.items():
                        await self._confirm_script(
                            keys=[
                                key,
                                f"{KEY_VERSION}:pending:{identity}:{bucket_start}",
                            ],
                            args=[
                                identity,
                                self._channel,
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
                state, replaced = results[-1]
            else:
                state, replaced = await self._apply_snapshot(
                    keys=[key], args=snapshot_arguments
                )
            _report_local_value(span, snapshot, replaced)
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
                        "outpost.pending.superseded": confirmation.superseded,
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
