import json
import socket
import sys
import typing
import uuid

import anyio
import uvicorn
from polar.outpost.client import Configuration, Snapshot
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.routing import Route

from python_client import read_lines


def customer_key(payload: typing.Mapping[str, object]) -> str:
    if payload.get("customer_id") is not None:
        return f"customer:{payload['customer_id']}:{payload['reducer_id']}"
    return f"external:{payload['external_customer_id']}:{payload['reducer_id']}"


# Polar's pull interval here: every read finds the Redis stale and pulls first, so a snapshot
# reaches the clients as fast as a push did.
PULL_INTERVAL = 0.05


class SnapshotServer:
    def __init__(self) -> None:
        # Its own organization: scenarios sharing a Redis keep their keys apart.
        self.organization_id = uuid.uuid4().hex
        self.configuration: Configuration = {
            "organization_id": self.organization_id,
            "reducers": [],
        }
        self.snapshots: dict[str, Snapshot] = {}
        # Polar's changes: a pull takes those after its cursor, the index of the last one taken.
        self.changes: list[Snapshot] = []
        # The external ids Polar stored: a confirm request is answered with those among them.
        self.ingested: set[str] = set()
        # Polar is unreachable for this many requests.
        self.dropped = 0

    async def handle(self, request: Request) -> Response:
        if request.headers.get("authorization") != "Bearer harness-token":
            return JSONResponse({}, status_code=401)
        if self.dropped:
            self.dropped -= 1
            return JSONResponse({}, status_code=503)
        route = f"{request.method} {request.url.path}"
        if route == "GET /v1/outpost/configuration":
            return JSONResponse(self.configuration)
        if route == "POST /v1/outpost/meter-usage":
            payload = await request.json()
            return JSONResponse([self._snapshot(payload)])
        if route == "POST /v1/outpost/confirm":
            payload = await request.json()
            return JSONResponse(
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
                    "snapshot": self.snapshots[customer_key(payload)],
                }
            )
        if route == "GET /v1/outpost/changes":
            cursor = request.query_params.get("cursor")
            start = int(cursor.split("-")[0]) if cursor else len(self.changes)
            return JSONResponse(
                {
                    "changes": self.changes[start:],
                    "cursor": f"{len(self.changes)}-0",
                    "has_more": False,
                    "reset": False,
                    "configuration_changed": False,
                    "next_poll_in": PULL_INTERVAL,
                }
            )
        return JSONResponse({}, status_code=404)

    async def command(self, operation: str, arguments: dict) -> None:
        if operation == "configure":
            self.configuration = {
                **arguments["configuration"],
                "organization_id": self.organization_id,
            }
            for snapshot in arguments["snapshots"]:
                self.snapshots[customer_key(snapshot)] = snapshot
        elif operation == "disconnect":
            self.dropped = 1
        elif operation == "snapshot":
            snapshot = typing.cast(Snapshot, arguments)
            self.snapshots[customer_key(snapshot)] = snapshot
            self.changes.append(snapshot)
        elif operation == "ingested":
            self.ingested.update(event["external_id"] for event in arguments["events"])
        else:
            raise ValueError(f"Unknown operation: {operation}")

    def _snapshot(self, payload: typing.Mapping[str, typing.Any]) -> Snapshot:
        return self.snapshots.get(customer_key(payload)) or {
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


async def main() -> None:
    fixture = SnapshotServer()
    app = Starlette(
        routes=[
            Route("/v1/outpost/{path:path}", fixture.handle, methods=["GET", "POST"])
        ]
    )
    server = uvicorn.Server(
        uvicorn.Config(
            app,
            log_config=None,
            log_level="error",
            access_log=False,
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
                server.should_exit = True


if __name__ == "__main__":
    anyio.run(main)
