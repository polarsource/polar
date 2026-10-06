import collections.abc
import contextlib
import typing

from pydantic import ValidationError
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import Response
from starlette.routing import Route

from outpost.env import Environment, get_environment
from outpost.event import EventsIngest
from outpost.reducer import Meter, get_matcher, reduce
from outpost.storage import Storage, create_storage


class LifespanState(typing.TypedDict):
    env: Environment
    storage: Storage


def get_state(request: Request) -> LifespanState:
    return request.state  # type: ignore


METERS: list[Meter] = [
    {
        "id": "METER_1",
        "filter": {
            "conjunction": "and",
            "clauses": [
                {
                    "property": "name",
                    "operator": "eq",
                    "value": "tool_call",
                },
            ],
        },
        "aggregation": {"func": "count"},
    }
]
METER_MATCHERS = [(meter, get_matcher(meter["filter"])) for meter in METERS]


async def ingest(request: Request) -> Response:
    try:
        payload = EventsIngest.model_validate_json(await request.body())
    except ValidationError:
        return Response(status_code=422)

    storage = get_state(request)["storage"]
    await storage.write_updates(reduce(METER_MATCHERS, payload.events))

    return Response(status_code=202)


@contextlib.asynccontextmanager
async def lifespan(_: Starlette) -> collections.abc.AsyncGenerator[LifespanState]:
    env = get_environment()
    async with create_storage(env) as storage:
        yield {
            "env": env,
            "storage": storage,
        }


app = Starlette(
    debug=True,
    lifespan=lifespan,
    routes=[
        Route("/ingest", ingest, methods=["POST"]),
    ],
)
