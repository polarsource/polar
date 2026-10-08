import typing

import anyio
import httpx2
from httpx2.websockets import WebSocketDisconnect, WebSocketNetworkError
from pydantic import TypeAdapter, ValidationError

from outpost.env import Environment
from outpost.logging import get_logger
from outpost.reducer import EventMatcher, Meter, get_matcher

log = get_logger(__name__)

MeterAdapter: TypeAdapter[Meter] = TypeAdapter(Meter)


class Configuration:
    def __init__(self) -> None:
        self.meters: list[tuple[Meter, EventMatcher]] = []
        self.ready = anyio.Event()

    def update(self, meters: list[dict[str, typing.Any]]) -> None:
        supported: list[tuple[Meter, EventMatcher]] = []
        for raw_meter in meters:
            try:
                meter = MeterAdapter.validate_python(raw_meter)
            except ValidationError:
                log.warning("Unsupported meter %s", raw_meter.get("id"))
                continue
            supported.append((meter, get_matcher(meter["filter"])))
        self.meters = supported
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
                        configuration.update(message["payload"]["meters"])
        except* WebSocketDisconnect, WebSocketNetworkError, httpx2.TransportError:
            log.warning("Polar connection lost, reconnecting")
            # ponytail: fixed delay, exponential backoff if Polar struggles on reconnect storms
            await anyio.sleep(1)
