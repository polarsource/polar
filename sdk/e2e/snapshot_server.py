import json
import socket
import sys
import typing

import anyio
import uvicorn
from polar.outpost.client import Configuration, Snapshot
from starlette.applications import Starlette
from starlette.routing import WebSocketRoute
from starlette.websockets import WebSocket, WebSocketDisconnect, WebSocketState

from python_client import read_lines


def customer_key(payload: typing.Mapping[str, object]) -> str:
    if payload.get("customer_id") is not None:
        return f"customer:{payload['customer_id']}:{payload['reducer_id']}"
    return f"external:{payload['external_customer_id']}:{payload['reducer_id']}"


class SnapshotServer:
    def __init__(self) -> None:
        self.configuration: Configuration = {"reducers": []}
        self.snapshots: dict[str, Snapshot] = {}
        # The external ids Polar stored: a confirm request is answered with those among them.
        self.ingested: set[str] = set()
        self.clients: dict[WebSocket, anyio.Lock] = {}

    async def websocket(self, websocket: WebSocket) -> None:
        if websocket.headers.get("authorization") != "Bearer harness-token":
            await websocket.close(code=1008)
            return
        await websocket.accept()
        self.clients[websocket] = anyio.Lock()
        try:
            while True:
                message = await websocket.receive_json()
                if message["type"] == "configuration":
                    await self._send(websocket, "configuration", self.configuration)
                elif message["type"] == "meter_usage":
                    payload = message["payload"]
                    snapshot = self.snapshots.get(customer_key(payload)) or {
                        "customer_id": payload.get("customer_id"),
                        "external_customer_id": payload.get("external_customer_id"),
                        "customer_exists": False,
                        "reducer_id": payload["reducer_id"],
                        "version": 0,
                        "cold_until": 0,
                        "count": 0,
                        "sum": 0,
                        "min": None,
                        "max": None,
                    }
                    await self._send(websocket, "meter_usage", snapshot)
                elif message["type"] == "confirm":
                    payload = message["payload"]
                    snapshot = self.snapshots[customer_key(payload)]
                    await self._send(
                        websocket,
                        "confirmed",
                        {
                            "reducer_id": payload["reducer_id"],
                            "customer_id": payload.get("customer_id"),
                            "external_customer_id": payload.get("external_customer_id"),
                            "bucket_start": payload["bucket_start"],
                            "ids": [
                                external_id
                                for external_id in payload["ids"]
                                if external_id in self.ingested
                            ],
                            "snapshot": snapshot,
                        },
                    )
                else:
                    await websocket.close(code=1008, reason="Unknown message")
                    return
        except WebSocketDisconnect:
            pass
        except (ValueError, KeyError, TypeError):
            await websocket.close(code=1008, reason="Invalid message")
        finally:
            self.clients.pop(websocket, None)

    async def command(self, operation: str, arguments: dict) -> None:
        if operation == "configure":
            self.configuration = arguments["configuration"]
            for snapshot in arguments["snapshots"]:
                self.snapshots[customer_key(snapshot)] = snapshot
        elif operation == "disconnect":
            await self.close(code=1012)
        elif operation == "snapshot":
            snapshot = typing.cast(Snapshot, arguments)
            self.snapshots[customer_key(snapshot)] = snapshot
            for websocket in list(self.clients):
                await self._send(websocket, "meter_usage", snapshot)
        elif operation == "ingested":
            self.ingested.update(event["external_id"] for event in arguments["events"])
        else:
            raise ValueError(f"Unknown operation: {operation}")

    async def close(self, code: int = 1001) -> None:
        for websocket, lock in list(self.clients.items()):
            async with lock:
                if websocket.application_state == WebSocketState.CONNECTED:
                    await websocket.close(code=code)

    async def _send(
        self, websocket: WebSocket, type: str, payload: typing.Mapping[str, object]
    ) -> None:
        lock = self.clients.get(websocket)
        if lock is None:
            return
        try:
            async with lock:
                if websocket.application_state == WebSocketState.CONNECTED:
                    await websocket.send_json({"type": type, "payload": payload})
        except (WebSocketDisconnect, OSError):
            pass


async def main() -> None:
    fixture = SnapshotServer()
    app = Starlette(routes=[WebSocketRoute("/v1/outpost/", fixture.websocket)])
    server = uvicorn.Server(
        uvicorn.Config(
            app,
            log_config=None,
            log_level="error",
            access_log=False,
            ws="wsproto",
            timeout_graceful_shutdown=5,
        )
    )
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen()
        listener.setblocking(False)
        port = listener.getsockname()[1]

        async def serve() -> None:
            await server.serve(sockets=[listener])

        async with anyio.create_task_group() as tasks:
            tasks.start_soon(serve)
            while not server.started:
                await anyio.sleep(0.01)
            print(json.dumps({"result": f"http://127.0.0.1:{port}"}), flush=True)
            try:
                async for line in read_lines(sys.stdin.fileno()):
                    try:
                        command = json.loads(line)
                        if command["operation"] == "close":
                            print(json.dumps({"result": None}), flush=True)
                            break
                        await fixture.command(
                            command["operation"], command["arguments"]
                        )
                        print(json.dumps({"result": None}), flush=True)
                    except (ValueError, KeyError, TypeError) as error:
                        print(json.dumps({"error": str(error)}), flush=True)
            finally:
                await fixture.close()
                server.should_exit = True


if __name__ == "__main__":
    anyio.run(main)
