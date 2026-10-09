import collections.abc
import contextlib
import datetime
import pathlib
import typing

import anyio
import httpx2
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from pydantic import ValidationError
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import FileResponse, JSONResponse, Response
from starlette.routing import Route

from outpost.env import Environment, get_environment
from outpost.event import Actor, EventsIngest
from outpost.metrics import (
    DECIDE_SECONDS,
    EVENTS_INGESTED,
    INGEST_SECONDS,
    REDUCE_SECONDS,
)
from outpost.polar import Configuration, Snapshots, create_client, listen
from outpost.reducer import (
    BUCKET_SIZE,
    get_bucket_start,
    get_consumed,
    get_event_keys,
    reduce,
)
from outpost.storage import Storage, create_storage


class LifespanState(typing.TypedDict):
    env: Environment
    storage: Storage
    configuration: Configuration
    polar_client: httpx2.AsyncClient
    snapshots: Snapshots


def get_state(request: Request) -> LifespanState:
    return request.state  # type: ignore


async def ingest(request: Request) -> Response:
    with INGEST_SECONDS.time():
        try:
            payload = EventsIngest.model_validate_json(await request.body())
        except ValidationError:
            return Response(status_code=422)

        state = get_state(request)
        for external_customer_id in {
            event.external_customer_id for event in payload.events
        }:
            state["snapshots"].warm_up(external_customer_id)
        claimed = await state["storage"].claim(get_event_keys(payload.events))
        oldest_bucket_start = (
            get_bucket_start(datetime.datetime.now(datetime.UTC)) - BUCKET_SIZE
        )
        with REDUCE_SECONDS.time():
            updates = reduce(
                state["configuration"].reducers,
                payload.events,
                oldest_bucket_start=oldest_bucket_start,
                claimed=claimed,
            )
        await state["storage"].write_updates(updates)
        EVENTS_INGESTED.inc(len(payload.events))

        duplicates = claimed.count(False)
        return JSONResponse(
            {
                "inserted": len(payload.events) - duplicates,
                "duplicates": duplicates,
            }
        )


SNAPSHOT_TIMEOUT = 5


async def customer_meters(request: Request) -> Response:
    with DECIDE_SECONDS.time():
        external_customer_id = request.query_params.get("external_customer_id")
        meter_id = request.query_params.get("meter_id")
        if external_customer_id is None or meter_id is None:
            return Response(status_code=422)

        state = get_state(request)
        reducer = state["configuration"].meters.get(meter_id)
        if reducer is None:
            return JSONResponse({"items": []})

        customer = await state["snapshots"].read(
            state["storage"], external_customer_id, timeout=SNAPSHOT_TIMEOUT
        )
        if customer is None:
            return Response(status_code=504)

        consumed = get_consumed(reducer, customer)
        credited = customer["credited"].get(meter_id, 0)
        return JSONResponse(
            {
                "items": [
                    {
                        "external_customer_id": external_customer_id,
                        "meter_id": meter_id,
                        "consumed_units": consumed,
                        "credited_units": credited,
                        "balance": credited - consumed,
                    }
                ]
            }
        )


async def actor(request: Request) -> Response:
    try:
        payload = Actor.model_validate_json(await request.body())
    except ValidationError:
        return Response(status_code=422)
    get_state(request)["snapshots"].warm_up(payload.external_customer_id)
    return Response(status_code=202)


async def metrics(_: Request) -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


async def dashboard(_: Request) -> Response:
    return FileResponse(pathlib.Path(__file__).parent / "dashboard.html")


@contextlib.asynccontextmanager
async def lifespan(_: Starlette) -> collections.abc.AsyncGenerator[LifespanState]:
    env = get_environment()
    configuration = Configuration()
    snapshots = Snapshots()
    async with (
        create_storage(env) as storage,
        create_client(env) as polar_client,
        anyio.create_task_group() as tg,
    ):
        tg.start_soon(listen, polar_client, configuration, snapshots, storage)
        with anyio.fail_after(30):
            await configuration.ready.wait()
        try:
            yield {
                "env": env,
                "storage": storage,
                "configuration": configuration,
                "polar_client": polar_client,
                "snapshots": snapshots,
            }
        finally:
            tg.cancel_scope.cancel()


app = Starlette(
    debug=True,
    lifespan=lifespan,
    routes=[
        Route("/ingest", ingest, methods=["POST"]),
        Route("/v1/customer-meters/", customer_meters),
        Route("/actor", actor, methods=["POST"]),
        # ponytail: per-process registry, multiprocess mode if metrics must cover --workers > 1
        Route("/metrics", metrics),
        Route("/dashboard", dashboard),
    ],
)
