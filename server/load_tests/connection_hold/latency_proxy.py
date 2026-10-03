"""TCP proxy that delays every server->client chunk by a fixed one-way latency.

Each SQL round trip through it costs `delay_ms` extra, like a remote or busy replica.
Ordering and pipelining are preserved: chunks are timestamped and released in order.
"""

import asyncio
import sys
import time

import uvloop

LISTEN_PORT = int(sys.argv[1])
TARGET_PORT = int(sys.argv[2])
DELAY = float(sys.argv[3]) / 1000


async def pipe(
    reader: asyncio.StreamReader, writer: asyncio.StreamWriter, delay: float
) -> None:
    queue: asyncio.Queue[tuple[float, bytes]] = asyncio.Queue()

    async def drain() -> None:
        while True:
            due, data = await queue.get()
            if not data:
                break
            wait = due - time.monotonic()
            if wait > 0:
                await asyncio.sleep(wait)
            writer.write(data)
            await writer.drain()
        writer.close()

    task = asyncio.create_task(drain())
    try:
        while data := await reader.read(65536):
            queue.put_nowait((time.monotonic() + delay, data))
    except ConnectionError:
        pass
    queue.put_nowait((0, b""))
    await task


async def handle(
    client_reader: asyncio.StreamReader, client_writer: asyncio.StreamWriter
) -> None:
    server_reader, server_writer = await asyncio.open_connection(
        "127.0.0.1", TARGET_PORT
    )
    await asyncio.gather(
        pipe(client_reader, server_writer, 0),
        pipe(server_reader, client_writer, DELAY),
        return_exceptions=True,
    )


async def main() -> None:
    server = await asyncio.start_server(handle, "127.0.0.1", LISTEN_PORT)
    async with server:
        await server.serve_forever()


uvloop.run(main())
