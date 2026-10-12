import collections.abc
import contextlib
import dataclasses
import datetime
import json
import math
import types
import typing

import anyio
import httpx
from httpx_ws import AsyncWebSocketSession, aconnect_ws
from redis.asyncio import Redis
from redis.asyncio.retry import Retry
from redis.backoff import NoBackoff
from redis.commands.core import AsyncScript

from polar.base import PolarError, deserialize
from polar.outpost.event import Event, EventInput
from polar.outpost.reducer import Reducer, get_bucket_start, get_matcher, reduce


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


WRITE_BUCKET_SCRIPT = """
local cutoff = redis.call('HGET', KEYS[1], 'cold_until')
if cutoff and tonumber(ARGV[1]) < tonumber(cutoff) then
    return 0
end
local field, func, raw_value = ARGV[2], ARGV[3], ARGV[4]
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
return 1
"""

APPLY_SNAPSHOT_SCRIPT = """
local cutoff = tonumber(ARGV[1])
local current = redis.call('HGET', KEYS[1], 'cold_until')
if current and tonumber(current) > cutoff then
    return 0
end
for _, field in ipairs(redis.call('HKEYS', KEYS[1])) do
    if string.sub(field, 1, 5) == 'cold:' or string.sub(field, 1, 9) == 'credited:'
        or (string.sub(field, 1, 7) == 'bucket:'
            and tonumber(string.match(field, ':(%-?%d+)$')) < cutoff) then
        redis.call('HDEL', KEYS[1], field)
    end
end
redis.call('HSET', KEYS[1], 'cold_until', ARGV[1])
for i = 2, #ARGV, 2 do
    redis.call('HSET', KEYS[1], ARGV[i], ARGV[i + 1])
end
return 1
"""


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

    async def __aenter__(self) -> typing.Self:
        if self._redis is not None:
            raise RuntimeError("Outpost is already connected")
        self._configured = anyio.Event()
        try:
            self._redis = await self._stack.enter_async_context(
                connect_redis(self.redis_url)
            )
            self._write_bucket = self._redis.register_script(WRITE_BUCKET_SCRIPT)
            self._apply_snapshot = self._redis.register_script(APPLY_SNAPSHOT_SCRIPT)
            self._websocket = await self._stack.enter_async_context(
                connect_websocket(self._client)
            )
            self._tasks = await self._stack.enter_async_context(
                anyio.create_task_group()
            )
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
            await self._write_bucket(
                keys=[f"outpost:state:{customer}"],
                args=[bucket_start, f"bucket:{reducer_id}:{bucket_start}", func, value],
            )
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
        await self.actor(
            customer_id=customer_id, external_customer_id=external_customer_id
        )
        state = typing.cast(
            dict[bytes, bytes],
            await self._require_redis().hgetall(f"outpost:state:{customer}"),
        )
        if b"cold_until" not in state:
            raise PolarError("Customer snapshot is not ready")
        cutoff = int(state[b"cold_until"])
        reducer_id = reducer["id"]
        values = [
            self._number(value)
            for field, value in state.items()
            if field.decode().startswith(f"bucket:{reducer_id}:")
            and int(field.decode().rsplit(":", 1)[1]) >= cutoff
        ]
        cold = state.get(f"cold:{reducer_id}".encode())
        if cold is not None:
            values.append(self._number(cold))
        func = reducer["aggregation"]["func"]
        if not values:
            consumed: int | float = 0
        elif func == "min":
            consumed = min(values)
        elif func == "max":
            consumed = max(values)
        else:
            consumed = sum(values)
        credited = self._number(state.get(f"credited:{meter_id}".encode(), b"0"))
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

    async def _warm_customer(self, customer: str) -> None:
        websocket = self._require_websocket()
        if customer in self._actors:
            return
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
                args: list[str | int | float] = [snapshot["cold_until"]]
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
                await self._apply_snapshot(
                    keys=[f"outpost:state:{customer}"],
                    args=args,
                )

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

    def _number(self, value: bytes) -> int | float:
        number = deserialize(json.loads(value), int | float)
        if isinstance(number, float) and not math.isfinite(number):
            raise ValueError("Stored aggregation values must be finite")
        return number
