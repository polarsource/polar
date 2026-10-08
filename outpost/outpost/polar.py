import math
import typing

import anyio
import httpx2
from httpx2.websockets import AsyncWebSocketSession
from pydantic import TypeAdapter, ValidationError

from outpost.env import Environment
from outpost.logging import get_logger
from outpost.reducer import EventMatcher, Reducer, Snapshot, get_matcher
from outpost.storage import Storage

log = get_logger(__name__)


class ConfiguredReducer(Reducer):
    meter_ids: list[str]


ReducerAdapter: TypeAdapter[ConfiguredReducer] = TypeAdapter(ConfiguredReducer)
SnapshotAdapter: TypeAdapter[Snapshot] = TypeAdapter(Snapshot)


class Configuration:
    def __init__(self) -> None:
        self.reducers: list[tuple[Reducer, EventMatcher]] = []
        self.meters: dict[str, Reducer] = {}
        self.ready = anyio.Event()

    def update(self, reducers: list[dict[str, typing.Any]]) -> None:
        supported: list[tuple[Reducer, EventMatcher]] = []
        meters: dict[str, Reducer] = {}
        for raw_reducer in reducers:
            try:
                reducer = ReducerAdapter.validate_python(raw_reducer)
            except ValidationError:
                log.warning("Unsupported reducer %s", raw_reducer.get("id"))
                continue
            supported.append((reducer, get_matcher(reducer["filter"])))
            meters.update(dict.fromkeys(reducer["meter_ids"], reducer))
        self.reducers = supported
        self.meters = meters
        self.ready.set()


class Snapshots:
    def __init__(self) -> None:
        # ponytail: never forgets a customer, evict idle ones if memory grows
        self.warm: dict[str, anyio.Event] = {}
        self.requests, self.pending_requests = anyio.create_memory_object_stream[str](
            math.inf
        )

    def warm_up(self, external_customer_id: str) -> anyio.Event:
        warm = self.warm.get(external_customer_id)
        if warm is None:
            warm = self.warm[external_customer_id] = anyio.Event()
            self.requests.send_nowait(external_customer_id)
        return warm

    async def apply(self, storage: Storage, payload: typing.Any) -> None:
        snapshot = SnapshotAdapter.validate_python(payload)
        await storage.apply_snapshot(snapshot)
        warm = self.warm.get(snapshot["external_customer_id"])
        if warm is not None:
            warm.set()


def request_snapshot(external_customer_id: str) -> dict[str, typing.Any]:
    return {
        "type": "snapshot",
        "payload": {"external_customer_id": external_customer_id},
    }


async def send_snapshot_requests(
    websocket: AsyncWebSocketSession, snapshots: Snapshots
) -> None:
    for external_customer_id in list(snapshots.warm):
        await websocket.send_json(request_snapshot(external_customer_id))
    while True:
        external_customer_id = await snapshots.pending_requests.receive()
        await websocket.send_json(request_snapshot(external_customer_id))


def create_client(env: Environment) -> httpx2.AsyncClient:
    return httpx2.AsyncClient(
        base_url=env.polar_api_url,
        headers={"Authorization": f"Bearer {env.polar_token}"},
    )


async def listen(
    client: httpx2.AsyncClient,
    configuration: Configuration,
    snapshots: Snapshots,
    storage: Storage,
) -> None:
    while True:
        try:
            async with (
                client.websocket("/v1/outpost/") as websocket,
                anyio.create_task_group() as tg,
            ):
                await websocket.send_json({"type": "configuration"})
                tg.start_soon(send_snapshot_requests, websocket, snapshots)
                while True:
                    message = await websocket.receive_json()
                    match message["type"]:
                        case "configuration":
                            configuration.update(message["payload"]["reducers"])
                        case "snapshot":
                            await snapshots.apply(storage, message["payload"])
        except* Exception:
            log.exception("Polar connection lost, reconnecting")
            # ponytail: fixed delay, exponential backoff if Polar struggles on reconnect storms
            await anyio.sleep(1)
