import collections
import collections.abc
import contextlib
import dataclasses
import datetime
import json
import math
import types
import typing
import uuid

import anyio
import httpx
from httpx_ws import AsyncWebSocketSession, aconnect_ws
from redis.asyncio import Redis
from redis.asyncio.retry import Retry
from redis.backoff import NoBackoff
from redis.commands.core import AsyncScript
from redis.exceptions import ConnectionError as RedisConnectionError
from redis.exceptions import TimeoutError as RedisTimeoutError

from polar.base import PolarError, deserialize
from polar.outpost.event import Event, EventInput
from polar.outpost.reducer import Reducer, get_bucket_start, get_matcher, reduce


def _number(value: str | bytes) -> int | float:
    number = deserialize(json.loads(value), int | float)
    if isinstance(number, float) and not math.isfinite(number):
        raise ValueError("Stored aggregation values must be finite")
    return number


def _generate_epoch() -> str:
    return uuid.uuid4().hex


@contextlib.asynccontextmanager
async def connect_redis(url: str) -> collections.abc.AsyncIterator[Redis]:
    async with Redis.from_url(url, retry=Retry(NoBackoff(), 0)) as redis:
        await redis.ping()
        yield redis


@contextlib.asynccontextmanager
async def connect_websocket(
    client: httpx.AsyncClient,
) -> collections.abc.AsyncIterator[AsyncWebSocketSession]:
    async with aconnect_ws(
        str(client.base_url.join("/v1/outpost/")), client
    ) as websocket:
        yield websocket


CACHE_SIZE = 1024
SYNC_INTERVAL = 30.0

READ_STATE_SCRIPT = """
if not redis.call('HGET', KEYS[1], 'epoch') then
    redis.call('HSET', KEYS[1], 'epoch', ARGV[1], 'revision', '0')
end
return redis.call('HGETALL', KEYS[1])
"""

PUBLISH_STATE_SCRIPT = """
if not redis.call('HGET', KEYS[1], 'epoch') then
    redis.call('HSET', KEYS[1], 'epoch', ARGV[3], 'revision', '0')
end
redis.call('HINCRBY', KEYS[1], 'revision', 1)
local state = redis.call('HGETALL', KEYS[1])
redis.call('PUBLISH', ARGV[2], cjson.encode({customer = ARGV[1], state = state}))
return state
"""

WRITE_BUCKET_SCRIPT = (
    """
local cutoff = redis.call('HGET', KEYS[1], 'cold_until')
if cutoff and tonumber(ARGV[4]) < tonumber(cutoff) then
    return redis.call('HGETALL', KEYS[1])
end
local field, func, raw_value = ARGV[5], ARGV[6], ARGV[7]
if func == 'count' then
    redis.call('HINCRBY', KEYS[1], field, raw_value)
elseif func == 'sum' then
    redis.call('HINCRBYFLOAT', KEYS[1], field, raw_value)
else
    assert(func == 'min' or func == 'max', 'Unsupported aggregation')
    local value = tonumber(raw_value)
    assert(value and value == value and math.abs(value) ~= math.huge, 'Invalid value')
    local stored = redis.call('HGET', KEYS[1], field)
    local previous = stored and assert(tonumber(stored), 'Invalid stored value')
    if previous then
        assert(previous == previous and math.abs(previous) ~= math.huge, 'Invalid stored value')
    end
    if not previous or (func == 'min' and value < previous)
        or (func == 'max' and value > previous) then
        redis.call('HSET', KEYS[1], field, raw_value)
    end
end
"""
    + PUBLISH_STATE_SCRIPT
)

APPLY_SNAPSHOT_SCRIPT = (
    """
local cutoff = tonumber(ARGV[4])
local current = redis.call('HGET', KEYS[1], 'cold_until')
if current and tonumber(current) > cutoff then
    return redis.call('HGETALL', KEYS[1])
end
for _, field in ipairs(redis.call('HKEYS', KEYS[1])) do
    if string.sub(field, 1, 5) == 'cold:' or string.sub(field, 1, 9) == 'credited:'
        or (string.sub(field, 1, 7) == 'bucket:'
            and tonumber(string.match(field, ':(%-?%d+)$')) < cutoff) then
        redis.call('HDEL', KEYS[1], field)
    end
end
redis.call('HSET', KEYS[1], 'cold_until', ARGV[4])
for i = 5, #ARGV, 2 do
    redis.call('HSET', KEYS[1], ARGV[i], ARGV[i + 1])
end
"""
    + PUBLISH_STATE_SCRIPT
)


class StateUpdate(typing.TypedDict):
    customer: str
    state: list[str]


@dataclasses.dataclass
class LocalState:
    state: dict[str, str] | None = None
    lock: anyio.Lock = dataclasses.field(default_factory=anyio.Lock)


class EventPayload(typing.TypedDict):
    name: str
    timestamp: typing.NotRequired[str]
    customer_id: typing.NotRequired[str]
    external_customer_id: typing.NotRequired[str]
    metadata: typing.NotRequired[dict[str, typing.Any]]


class Configuration(typing.TypedDict):
    reducers: list[Reducer]


class Snapshot(typing.TypedDict):
    customer_id: typing.NotRequired[str]
    external_customer_id: typing.NotRequired[str]
    cold_until: int
    cold: dict[str, int | float]
    credited: dict[str, int | float]


@dataclasses.dataclass
class IngestResult:
    inserted: int
    duplicates: int = 0


@dataclasses.dataclass(kw_only=True)
class CustomerMeter:
    meter_id: str
    consumed_units: int | float
    credited_units: int | float
    balance: int | float
    customer_id: str | None = None
    external_customer_id: str | None = None


class Outpost:
    def __init__(self, redis_url: str, *, client: httpx.AsyncClient) -> None:
        self.redis_url = redis_url
        self._client = client
        self._stack = contextlib.AsyncExitStack()
        self._redis: Redis | None = None
        self._websocket: AsyncWebSocketSession | None = None
        self._tasks: anyio.abc.TaskGroup | None = None
        self._reducers: list[Reducer] = []
        self._actors: set[str] = set()
        self._configured = anyio.Event()
        self._write_bucket: AsyncScript | None = None
        self._apply_snapshot: AsyncScript | None = None
        self._read_state: AsyncScript | None = None
        self._cache: collections.OrderedDict[str, LocalState] = (
            collections.OrderedDict()
        )
        self._synced = anyio.Event()
        self._channel = ""

    async def __aenter__(self) -> typing.Self:
        if self._redis is not None:
            raise RuntimeError("Outpost is already connected")
        self._configured = anyio.Event()
        self._synced = anyio.Event()
        try:
            self._redis = await self._stack.enter_async_context(
                connect_redis(self.redis_url)
            )
            self._channel = f"outpost:{self._redis.connection_pool.connection_kwargs.get('db', 0)}:updates"
            self._read_state = self._redis.register_script(READ_STATE_SCRIPT)
            self._write_bucket = self._redis.register_script(WRITE_BUCKET_SCRIPT)
            self._apply_snapshot = self._redis.register_script(APPLY_SNAPSHOT_SCRIPT)
            self._websocket = await self._stack.enter_async_context(
                connect_websocket(self._client)
            )
            self._tasks = await self._stack.enter_async_context(
                anyio.create_task_group()
            )
            with anyio.fail_after(5):
                await self._tasks.start(self._listen_redis)
            self._tasks.start_soon(self._listen_websocket)
            await self._require_websocket().send_json({"type": "configuration"})
        except BaseException:
            try:
                if self._tasks is not None:
                    self._tasks.cancel_scope.cancel()
                await self._stack.aclose()
            finally:
                self._redis = None
                self._websocket = None
                self._tasks = None
                self._reducers = []
                self._write_bucket = None
                self._apply_snapshot = None
                self._read_state = None
                self._cache.clear()
            raise
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None = None,
        exc_val: BaseException | None = None,
        exc_tb: types.TracebackType | None = None,
    ) -> None:
        try:
            if self._tasks is not None:
                self._tasks.cancel_scope.cancel()
            await self._stack.__aexit__(exc_type, exc_val, exc_tb)
        finally:
            self._redis = None
            self._websocket = None
            self._tasks = None
            self._reducers = []
            self._actors.clear()
            self._write_bucket = None
            self._apply_snapshot = None
            self._read_state = None
            self._cache.clear()

    async def ingest(
        self, *, events: collections.abc.Sequence[EventInput]
    ) -> IngestResult:
        self._require_redis()
        if not events:
            return IngestResult(inserted=0)
        parsed = [self._parse_event(event) for event in events]
        with anyio.fail_after(5):
            await self._configured.wait()
        reducers = self._reducers
        updates = reduce(
            [(reducer, get_matcher(reducer["filter"])) for reducer in reducers],
            parsed,
            oldest_bucket_start=min(
                get_bucket_start(event.timestamp) for event in parsed
            ),
        )
        for customer in {event.external_customer_id for event in parsed}:
            await self._warm_customer(customer)
        assert self._write_bucket is not None
        for (customer, reducer_id, bucket_start, func), value in updates.items():
            epoch = _generate_epoch()
            state = await self._write_bucket(
                keys=[f"outpost:state:{customer}"],
                args=[
                    customer,
                    self._channel,
                    epoch,
                    bucket_start,
                    f"bucket:{reducer_id}:{bucket_start}",
                    func,
                    value,
                ],
            )
            await self._receive_state(customer, self._decode_state(state))
        return IngestResult(inserted=len(parsed))

    async def customer_meter(
        self,
        *,
        meter_id: str,
        customer_id: str | None = None,
        external_customer_id: str | None = None,
    ) -> CustomerMeter | None:
        customer = self._customer_key(customer_id, external_customer_id)
        self._require_redis()
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
            return None
        local = await self._warm_customer(customer)
        state = local.state
        if state is None or "cold_until" not in state:
            raise PolarError("Customer snapshot is not ready")
        cutoff = int(state["cold_until"])
        reducer_id = reducer["id"]
        values = [
            _number(value)
            for field, value in state.items()
            if field.startswith(f"bucket:{reducer_id}:")
            and int(field.rsplit(":", 1)[1]) >= cutoff
        ]
        cold = state.get(f"cold:{reducer_id}")
        if cold is not None:
            values.append(_number(cold))
        func = reducer["aggregation"]["func"]
        if not values:
            consumed: int | float = 0
        elif func == "min":
            consumed = min(values)
        elif func == "max":
            consumed = max(values)
        else:
            consumed = sum(values)
        credited = _number(state.get(f"credited:{meter_id}", "0"))
        return CustomerMeter(
            meter_id=meter_id,
            customer_id=customer_id,
            external_customer_id=external_customer_id,
            consumed_units=consumed,
            credited_units=credited,
            balance=credited - consumed,
        )

    async def actor(
        self,
        *,
        customer_id: str | None = None,
        external_customer_id: str | None = None,
    ) -> None:
        customer = self._customer_key(customer_id, external_customer_id)
        await self._warm_customer(customer)

    def _require_redis(self) -> Redis:
        if self._redis is None:
            raise RuntimeError("Use Outpost inside an async with block")
        return self._redis

    def _require_websocket(self) -> AsyncWebSocketSession:
        if self._websocket is None:
            raise RuntimeError("Use Outpost inside an async with block")
        return self._websocket

    async def _warm_customer(self, customer: str) -> LocalState:
        websocket = self._require_websocket()
        with anyio.fail_after(5):
            await self._synced.wait()
        local = self._cache.get(customer)
        if local is None:
            local = LocalState()
            self._cache[customer] = local
            if len(self._cache) > CACHE_SIZE:
                evicted, _ = self._cache.popitem(last=False)
                self._actors.discard(evicted)
        self._cache.move_to_end(customer)
        if local.state is not None and customer in self._actors:
            return local
        async with local.lock:
            if local.state is None:
                local.state = await self._load_state(customer)
            if customer not in self._actors:
                kind, identifier = customer.split(":", 1)
                await websocket.send_json(
                    {
                        "type": "snapshot",
                        "payload": {
                            "customer_id"
                            if kind == "customer"
                            else "external_customer_id": identifier
                        },
                    }
                )
                self._actors.add(customer)
        return local

    async def _load_state(self, customer: str) -> dict[str, str]:
        assert self._read_state is not None
        epoch = _generate_epoch()
        state = await self._read_state(
            keys=[f"outpost:state:{customer}"],
            args=[epoch],
        )
        return self._decode_state(state)

    def _decode_state(
        self, values: collections.abc.Sequence[str | bytes]
    ) -> dict[str, str]:
        decoded = [
            value.decode() if isinstance(value, bytes) else value for value in values
        ]
        return dict(zip(decoded[::2], decoded[1::2], strict=True))

    async def _receive_state(self, customer: str, state: dict[str, str]) -> None:
        local = self._cache.get(customer)
        if local is None:
            return
        async with local.lock:
            current = local.state
            if current is None:
                return
            if current["epoch"] != state["epoch"]:
                state = await self._load_state(customer)
            elif int(current["revision"]) >= int(state["revision"]):
                return
            local.state = state

    async def _refresh_states(self) -> None:
        for customer, local in list(self._cache.items()):
            async with local.lock:
                local.state = await self._load_state(customer)

    async def _listen_redis(
        self,
        *,
        task_status: anyio.abc.TaskStatus[None] = anyio.TASK_STATUS_IGNORED,
    ) -> None:
        started = False
        while True:
            async with self._require_redis().pubsub() as pubsub:
                try:
                    await pubsub.subscribe(self._channel)
                    subscribed = await pubsub.get_message(timeout=5)
                    if subscribed is None or subscribed["type"] != "subscribe":
                        raise RedisTimeoutError(
                            "Outpost subscription was not acknowledged"
                        )
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
                            update = deserialize(
                                json.loads(message["data"]), StateUpdate
                            )
                            await self._receive_state(
                                update["customer"],
                                dict(
                                    zip(
                                        update["state"][::2],
                                        update["state"][1::2],
                                        strict=True,
                                    )
                                ),
                            )
                        if anyio.current_time() >= next_refresh:
                            await self._refresh_states()
                            next_refresh = anyio.current_time() + SYNC_INTERVAL
                except (RedisConnectionError, RedisTimeoutError):
                    self._synced = anyio.Event()
                    for local in self._cache.values():
                        local.state = None
            await anyio.sleep(1)

    async def _listen_websocket(self) -> None:
        websocket = self._require_websocket()
        while True:
            message = await websocket.receive_json()
            if message["type"] == "configuration":
                self._reducers = deserialize(message["payload"], Configuration)[
                    "reducers"
                ]
                self._configured.set()
            elif message["type"] == "snapshot":
                snapshot = deserialize(message["payload"], Snapshot)
                customer = self._customer_key(
                    snapshot.get("customer_id"), snapshot.get("external_customer_id")
                )
                epoch = _generate_epoch()
                args: list[str | int | float] = [
                    customer,
                    self._channel,
                    epoch,
                    snapshot["cold_until"],
                ]
                for group, values in (
                    ("cold", snapshot["cold"]),
                    ("credited", snapshot["credited"]),
                ):
                    for identifier, value in values.items():
                        if isinstance(value, float) and not math.isfinite(value):
                            raise ValueError("Snapshot values must be finite")
                        args.extend((f"{group}:{identifier}", value))
                # shortcut: equal-cutoff snapshots are unordered until Polar supplies snapshot versions.
                assert self._apply_snapshot is not None
                state = await self._apply_snapshot(
                    keys=[f"outpost:state:{customer}"],
                    args=args,
                )
                await self._receive_state(customer, self._decode_state(state))

    def _parse_event(self, event: EventInput) -> Event:
        payload = deserialize({key: event[key] for key in event}, EventPayload)
        customer = self._customer_key(
            payload.get("customer_id"), payload.get("external_customer_id")
        )
        timestamp = payload.get("timestamp")
        return Event(
            name=payload["name"],
            external_customer_id=customer,
            timestamp=datetime.datetime.fromisoformat(timestamp)
            if timestamp is not None
            else datetime.datetime.now(datetime.UTC),
            metadata=payload.get("metadata", {}),
        )

    def _customer_key(
        self, customer_id: str | None, external_customer_id: str | None
    ) -> str:
        if (customer_id is None) == (external_customer_id is None):
            raise ValueError("Provide exactly one customer_id or external_customer_id")
        if customer_id is not None:
            return f"customer:{customer_id}"
        return f"external:{external_customer_id}"
