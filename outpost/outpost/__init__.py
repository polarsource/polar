import collections.abc
import contextlib
import typing

import anyio
from pydantic import ValidationError
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.routing import Route

from outpost.env import Environment, get_environment
from outpost.event import EventsIngest
from outpost.polar import Configuration, create_client, listen
from outpost.reducer import reduce
from outpost.storage import Storage, create_storage


class LifespanState(typing.TypedDict):
    env: Environment
    storage: Storage
    configuration: Configuration


def get_state(request: Request) -> LifespanState:
    return request.state  # type: ignore


async def ingest(request: Request) -> Response:
    try:
        payload = EventsIngest.model_validate_json(await request.body())
    except ValidationError:
        return Response(status_code=422)

    state = get_state(request)
    await state["storage"].write_updates(
        reduce(state["configuration"].meters, payload.events)
    )

    return JSONResponse({"inserted": len(payload.events), "duplicates": 0})


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
            }
        finally:
            tg.cancel_scope.cancel()


app = Starlette(
    debug=True,
    lifespan=lifespan,
    routes=[
        Route("/v1/events/ingest", ingest, methods=["POST"]),
    ],
)
