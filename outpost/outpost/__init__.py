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
from outpost.redis import Redis, create_redis, write_updates
from outpost.reducer import reduce


class LifespanState(typing.TypedDict):
    env: Environment
    redis: Redis


def get_state(request: Request) -> LifespanState:
    return request.state  # type: ignore


async def ingest(request: Request) -> Response:
    try:
        payload = EventsIngest.model_validate_json(await request.body())
    except ValidationError:
        return Response(status_code=422)

    redis = get_state(request)["redis"]
    await write_updates(
        redis,
        reduce(
            [
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
            ],
            payload.events,
        ),
    )

    return Response(status_code=202)


@contextlib.asynccontextmanager
async def lifespan(_: Starlette) -> collections.abc.AsyncGenerator[LifespanState]:
    env = get_environment()
    async with create_redis(str(env.redis_dsn)) as redis:
        yield {
            "env": env,
            "redis": redis,
        }


app = Starlette(
    debug=True,
    lifespan=lifespan,
    routes=[
        Route("/ingest", ingest, methods=["POST"]),
    ],
)
