import typing

import anyio
import httpx2
from pydantic import TypeAdapter, ValidationError

from outpost.env import Environment
from outpost.logging import get_logger
from outpost.reducer import EventMatcher, Reducer, get_matcher

log = get_logger(__name__)

ReducerAdapter: TypeAdapter[Reducer] = TypeAdapter(Reducer)


class Configuration:
    def __init__(self) -> None:
        self.reducers: list[tuple[Reducer, EventMatcher]] = []
        self.ready = anyio.Event()

    def update(self, reducers: list[dict[str, typing.Any]]) -> None:
        supported: list[tuple[Reducer, EventMatcher]] = []
        for raw_reducer in reducers:
            try:
                reducer = ReducerAdapter.validate_python(raw_reducer)
            except ValidationError:
                log.warning("Unsupported reducer %s", raw_reducer.get("id"))
                continue
            supported.append((reducer, get_matcher(reducer["filter"])))
        self.reducers = supported
        self.ready.set()


def create_client(env: Environment) -> httpx2.AsyncClient:
    return httpx2.AsyncClient(
        base_url=env.polar_api_url,
        headers={"Authorization": f"Bearer {env.polar_token}"},
    )


async def listen(client: httpx2.AsyncClient, configuration: Configuration) -> None:
    while True:
        try:
            async with client.websocket("/v1/outpost/") as websocket:
                await websocket.send_json({"type": "configuration"})
                while True:
                    message = await websocket.receive_json()
                    if message["type"] == "configuration":
                        configuration.update(message["payload"]["reducers"])
        except* Exception:
            log.exception("Polar connection lost, reconnecting")
            # ponytail: fixed delay, exponential backoff if Polar struggles on reconnect storms
            await anyio.sleep(1)
