import dataclasses
import json
import sys

import anyio
import httpx
from polar.base import PolarError
from polar.outpost import Outpost


async def main() -> None:
    redis_url, base_url = sys.argv[1:]
    async with (
        httpx.AsyncClient(
            base_url=base_url, headers={"Authorization": "Bearer harness-token"}
        ) as client,
        Outpost(redis_url, client=client) as outpost,
    ):
        print(json.dumps({"result": None}), flush=True)
        while line := await anyio.to_thread.run_sync(sys.stdin.readline):
            try:
                command = json.loads(line)
                operation = command["operation"]
                if operation == "close":
                    print(json.dumps({"result": None}), flush=True)
                    break
                methods = {
                    "ingest": outpost.ingest,
                    "read": outpost.customer_meter,
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
