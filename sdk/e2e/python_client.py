import dataclasses
import json
import os
import sys
import typing

import anyio
import httpx
from polar.base import PolarError
from polar.outpost import Outpost


async def read_lines(fd: int) -> typing.AsyncIterator[bytes]:
    pending = b""
    while True:
        await anyio.wait_readable(fd)
        chunk = os.read(fd, 65536)
        if not chunk:
            if pending:
                yield pending
            return
        *lines, pending = (pending + chunk).split(b"\n")
        for line in lines:
            yield line


async def main() -> None:
    redis_url, base_url = sys.argv[1:]
    async with (
        httpx.AsyncClient(
            base_url=base_url, headers={"Authorization": "Bearer harness-token"}
        ) as client,
        Outpost(redis_url, client=client, telemetry=False) as outpost,
    ):
        print(json.dumps({"result": None}), flush=True)
        async for line in read_lines(sys.stdin.fileno()):
            try:
                command = json.loads(line)
                operation = command["operation"]
                if operation == "close":
                    print(json.dumps({"result": None}), flush=True)
                    break
                if operation == "ingest":
                    for event in command["arguments"]["events"]:
                        await outpost.track(event)
                    print(json.dumps({"result": None}), flush=True)
                    continue
                if operation == "confirm":
                    await outpost.confirm(command["arguments"]["events"])
                    print(json.dumps({"result": None}), flush=True)
                    continue
                methods = {
                    "read": outpost.meter,
                    "actor": outpost.actor,
                }
                result = await methods[operation](**command["arguments"])
                response = {
                    "result": dataclasses.asdict(result) if result is not None else None
                }
            except (
                PolarError,
                ValueError,
                TypeError,
                KeyError,
                RuntimeError,
                TimeoutError,
            ) as error:
                response = {"error": f"{type(error).__name__}: {error}"}
            print(json.dumps(response), flush=True)


if __name__ == "__main__":
    anyio.run(main)
