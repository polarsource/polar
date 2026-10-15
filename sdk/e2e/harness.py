import contextlib
import copy
import dataclasses
import json
import os
import pathlib
import socket
import subprocess
import sys
import tempfile
import typing
import uuid

import anyio
from anyio.streams.buffered import BufferedByteReceiveStream
from polar.outpost.client import Configuration, EventInput, Snapshot
from redis.asyncio import Redis
from redis.exceptions import ConnectionError as RedisConnectionError

ROOT = pathlib.Path(__file__).resolve().parent


class CustomerID(typing.TypedDict):
    customer_id: str


class ExternalCustomerID(typing.TypedDict):
    external_customer_id: str


class CustomerMeterRequest(CustomerID):
    meter_id: str


class ExternalCustomerMeterRequest(ExternalCustomerID):
    meter_id: str


class IngestArguments(typing.TypedDict):
    events: list[EventInput]


class MeterValues(typing.TypedDict, total=False):
    consumed_units: int | float
    credited_units: int | float
    balance: int | float


@dataclasses.dataclass(frozen=True)
class TimelineStep:
    at: float

    def __post_init__(self) -> None:
        if self.at < 0:
            raise ValueError("Timeline offsets must be nonnegative")


@dataclasses.dataclass(frozen=True)
class IngestStep(TimelineStep):
    client: str
    arguments: IngestArguments
    operation: typing.ClassVar[typing.Literal["ingest"]] = "ingest"


@dataclasses.dataclass(frozen=True)
class ReadStep(TimelineStep):
    client: str
    arguments: CustomerMeterRequest | ExternalCustomerMeterRequest
    expected: MeterValues | None
    within: float = 0
    operation: typing.ClassVar[typing.Literal["read"]] = "read"

    def __post_init__(self) -> None:
        super().__post_init__()
        if self.within < 0:
            raise ValueError("Read deadlines must be nonnegative")


@dataclasses.dataclass(frozen=True)
class ActorStep(TimelineStep):
    client: str
    arguments: CustomerID | ExternalCustomerID
    operation: typing.ClassVar[typing.Literal["actor"]] = "actor"


@dataclasses.dataclass(frozen=True)
class RestartStep(TimelineStep):
    client: str
    operation: typing.ClassVar[typing.Literal["restart"]] = "restart"


@dataclasses.dataclass(frozen=True)
class DisconnectStep(TimelineStep):
    arguments: dict[str, object] = dataclasses.field(default_factory=dict)
    client: typing.ClassVar[typing.Literal["polar"]] = "polar"
    operation: typing.ClassVar[typing.Literal["disconnect"]] = "disconnect"


@dataclasses.dataclass(frozen=True)
class SnapshotStep(TimelineStep):
    arguments: Snapshot
    client: typing.ClassVar[typing.Literal["polar"]] = "polar"
    operation: typing.ClassVar[typing.Literal["snapshot"]] = "snapshot"


Step: typing.TypeAlias = (
    IngestStep | ReadStep | ActorStep | RestartStep | DisconnectStep | SnapshotStep
)


@dataclasses.dataclass(frozen=True)
class Scenario:
    name: str
    configuration: Configuration
    snapshots: list[Snapshot]
    steps: list[Step]


class ClientError(Exception):
    pass


class Process:
    def __init__(self, process: anyio.abc.Process) -> None:
        self.process = process
        self.lock = anyio.Lock()
        assert process.stdout is not None
        self.stdout = BufferedByteReceiveStream(process.stdout)

    async def receive(self) -> typing.Any:
        try:
            with anyio.fail_after(10):
                line = await self.stdout.receive_until(b"\n", max_bytes=1024 * 1024)
        except anyio.IncompleteRead as error:
            raise RuntimeError(
                f"Harness process exited with {self.process.returncode}"
            ) from error
        response = json.loads(line)
        if "error" in response:
            raise ClientError(response["error"])
        return response["result"]

    async def request(
        self, operation: str, arguments: typing.Mapping[str, object]
    ) -> typing.Any:
        async with self.lock:
            assert self.process.stdin is not None
            await self.process.stdin.send(
                (
                    json.dumps({"operation": operation, "arguments": arguments}) + "\n"
                ).encode()
            )
            return await self.receive()


async def stop(process: anyio.abc.Process) -> None:
    with anyio.CancelScope(shield=True):
        if process.returncode is None:
            process.terminate()
            with anyio.move_on_after(5):
                await process.wait()
            if process.returncode is None:
                process.kill()
                await process.wait()
        await process.aclose()


@contextlib.asynccontextmanager
async def launch(*command: str):
    process = await anyio.open_process(
        command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=None
    )
    rpc = Process(process)
    try:
        ready = await rpc.receive()
        yield rpc, ready
    finally:
        with anyio.CancelScope(shield=True):
            if process.stdin is not None:
                await process.stdin.aclose()
            with anyio.move_on_after(5):
                await process.wait()
            await stop(process)


@contextlib.asynccontextmanager
async def local_redis():
    if url := os.environ.get("E2E_REDIS_URL"):
        async with Redis.from_url(url) as redis:
            await redis.ping()
        yield url
        return
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    with tempfile.TemporaryDirectory(prefix="outpost-e2e-") as directory:
        process = await anyio.open_process(
            [
                "redis-server",
                "--bind",
                "127.0.0.1",
                "--port",
                str(port),
                "--save",
                "",
                "--appendonly",
                "no",
                "--dir",
                directory,
            ],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=None,
        )
        try:
            url = f"redis://127.0.0.1:{port}/0"
            async with Redis.from_url(url) as redis:
                with anyio.fail_after(5):
                    while True:
                        if process.returncode is not None:
                            raise RuntimeError("Harness Redis failed to start")
                        try:
                            await redis.ping()
                            break
                        except RedisConnectionError:
                            await anyio.sleep(0.05)
            yield url
        finally:
            await stop(process)


async def run(
    scenario: Scenario, language: typing.Literal["python", "typescript"]
) -> None:
    scenario = copy.deepcopy(scenario)
    namespace = uuid.uuid4().hex
    customers = set()
    payloads = [*scenario.snapshots]
    for step in scenario.steps:
        if isinstance(step, IngestStep):
            payloads.extend(step.arguments["events"])
        elif not isinstance(step, RestartStep):
            payloads.append(step.arguments)
    for payload in {id(payload): payload for payload in payloads}.values():
        customer_payload = typing.cast(dict[str, object], payload)
        for field, prefix in (
            ("customer_id", "customer"),
            ("external_customer_id", "external"),
        ):
            if customer := customer_payload.get(field):
                customer_payload[field] = f"{namespace}:{customer}"
                customers.add(f"{prefix}:{customer_payload[field]}")
    transcript = []
    async with contextlib.AsyncExitStack() as stack:
        redis_url = await stack.enter_async_context(local_redis())
        redis = await stack.enter_async_context(Redis.from_url(redis_url))
        keys = [
            f"outpost:state:{customer}:{reducer['id']}"
            for customer in customers
            for reducer in scenario.configuration["reducers"]
        ]
        if keys:
            stack.push_async_callback(redis.delete, *keys)
        server, base_url = await stack.enter_async_context(
            launch(sys.executable, str(ROOT / "snapshot_server.py"))
        )
        await server.request(
            "configure",
            {
                "configuration": scenario.configuration,
                "snapshots": scenario.snapshots,
            },
        )
        clients: dict[str, Process] = {}
        contexts: dict[str, typing.Any] = {}
        client_names = dict.fromkeys(
            step.client for step in scenario.steps if step.client != "polar"
        )
        locks = {name: anyio.Lock() for name in [*client_names, "polar"]}

        async def start_client(name: str) -> None:
            if language == "python":
                command = (sys.executable, str(ROOT / "python_client.py"))
            elif language == "typescript":
                command = ("node", str(ROOT / "typescript_client.ts"))
            else:
                raise ValueError(f"Unknown SDK language: {language}")
            context = launch(*command, redis_url, base_url)
            client, _ = await context.__aenter__()
            contexts[name] = context
            clients[name] = client
            stack.push_async_callback(context.__aexit__, None, None, None)

        for name in client_names:
            await start_client(name)
        started = anyio.current_time()

        async def command(step: Step) -> typing.Any:
            async with locks[step.client]:
                if isinstance(step, RestartStep):
                    await contexts[step.client].__aexit__(None, None, None)
                    await start_client(step.client)
                    return None
                target = server if step.client == "polar" else clients[step.client]
                return await target.request(step.operation, step.arguments)

        async def execute(step: Step) -> None:
            await anyio.sleep_until(started + step.at)
            read = isinstance(step, ReadStep)
            expected = step.expected if isinstance(step, ReadStep) else None
            deadline = anyio.current_time() + (
                step.within if isinstance(step, ReadStep) else 0
            )
            while True:
                try:
                    result = await command(step)
                except ClientError as error:
                    if not read or "Customer snapshot is not ready" not in str(error):
                        raise
                    result = str(error)
                transcript.append(
                    {
                        "scheduled": step.at,
                        "actual": anyio.current_time() - started,
                        "client": step.client,
                        "operation": step.operation,
                        "arguments": {}
                        if isinstance(step, RestartStep)
                        else step.arguments,
                        "result": result,
                    }
                )
                if not read:
                    return
                if expected is None and result is None:
                    return
                if (
                    expected is not None
                    and isinstance(result, dict)
                    and all(
                        result.get(field) == value for field, value in expected.items()
                    )
                ):
                    return
                if anyio.current_time() >= deadline:
                    raise AssertionError(
                        f"{scenario.name}/{step.client}: expected {expected}, got {result}"
                    )
                await anyio.sleep(0.02)

        try:
            async with anyio.create_task_group() as tasks:
                for step in scenario.steps:
                    tasks.start_soon(execute, step)
        except Exception:
            print(json.dumps(transcript, indent=2))
            raise
