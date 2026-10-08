import collections.abc
import contextlib
import pathlib
import typing

import anyio
import httpx2
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from pydantic import ValidationError
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import FileResponse, Response
from starlette.routing import Route

from outpost.env import Environment, get_environment
from outpost.event import EventsIngest
from outpost.metrics import EVENTS_INGESTED, INGEST_SECONDS, REDUCE_SECONDS
from outpost.polar import Configuration, create_client, listen
from outpost.reducer import reduce
from outpost.storage import Storage, create_storage


class LifespanState(typing.TypedDict):
    env: Environment
    storage: Storage
    configuration: Configuration
    polar_client: httpx2.AsyncClient


def get_state(request: Request) -> LifespanState:
    return request.state  # type: ignore


async def ingest(request: Request) -> Response:
    with INGEST_SECONDS.time():
        try:
            payload = EventsIngest.model_validate_json(await request.body())
        except ValidationError:
            return Response(status_code=422)

        state = get_state(request)
        with REDUCE_SECONDS.time():
            updates = reduce(state["configuration"].meters, payload.events)
        await state["storage"].write_updates(updates)
        EVENTS_INGESTED.inc(len(payload.events))

        return Response(status_code=202)


async def metrics(_: Request) -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


async def dashboard(_: Request) -> Response:
    return FileResponse(pathlib.Path(__file__).parent / "dashboard.html")


@contextlib.asynccontextmanager
async def lifespan(_: Starlette) -> collections.abc.AsyncGenerator[LifespanState]:
    env = get_environment()
    configuration = Configuration()
    async with (
        create_storage(env) as storage,
        create_client(env) as polar_client,
        anyio.create_task_group() as tg,
    ):
        tg.start_soon(listen, polar_client, configuration)
        with anyio.fail_after(30):
            await configuration.ready.wait()
        try:
            yield {
                "env": env,
                "storage": storage,
                "configuration": configuration,
                "polar_client": polar_client,
            }
        finally:
            tg.cancel_scope.cancel()


app = Starlette(
    debug=True,
    lifespan=lifespan,
    routes=[
        Route("/ingest", ingest, methods=["POST"]),
        # ponytail: per-process registry, multiprocess mode if metrics must cover --workers > 1
        Route("/metrics", metrics),
        Route("/dashboard", dashboard),
    ],
)
