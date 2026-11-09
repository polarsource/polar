from typing import Annotated

import anyio.to_thread
from fastapi import Body, Depends, Query, Response

from polar.exceptions import ResourceNotFound
from polar.kit.db.postgres import AsyncSessionMaker
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session, get_db_sessionmaker
from polar.redis import Redis, get_redis
from polar.routing import APIRouter

from . import stream
from .auth import OutpostWrite
from .schemas import (
    Changes,
    Configuration,
    Confirmation,
    ConfirmRequest,
    MeterUsageRequest,
    Snapshot,
)
from .service import outpost as outpost_service

router = APIRouter(prefix="/outpost", tags=["outpost", APITag.private])


@router.get("/changes", response_model=Changes)
async def changes(
    auth_subject: OutpostWrite,
    cursor: Annotated[stream.Cursor | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=1000)] = 500,
    redis: Redis = Depends(get_redis),
    # The primary: a change is logged after its commit, a replica may not have it yet.
    session: AsyncSession = Depends(get_db_session),
) -> Changes:
    """The snapshots that changed since the cursor.

    When no cursor is provided, returns the cursor to start pulling from."""
    return await outpost_service.get_changes(
        session, redis, auth_subject.subject, cursor, limit
    )


ReducerNotFound = {
    "description": "Reducer not found.",
    "model": ResourceNotFound.schema(),
}


@router.get("/configuration", response_model=Configuration)
async def configuration(
    auth_subject: OutpostWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Configuration:
    """The reducers Outpost runs."""
    return await outpost_service.get_configuration(session, auth_subject.subject)


@router.post(
    "/meter-usage",
    response_model=list[Snapshot],
    responses={404: ReducerNotFound},
)
async def meter_usage(
    payload: MeterUsageRequest,
    auth_subject: OutpostWrite,
    session: AsyncSession = Depends(get_db_session),
) -> list[Snapshot]:
    """The snapshot of every identity of each requested customer."""
    return await outpost_service.get_requested_meter_usage(
        session, auth_subject.subject, payload.identities
    )


@router.post(
    "/confirm",
    response_model=Confirmation,
    responses={404: ReducerNotFound},
)
async def confirm(
    payload: ConfirmRequest,
    auth_subject: OutpostWrite,
    sessionmaker: AsyncSessionMaker = Depends(get_db_sessionmaker),
) -> Confirmation:
    """The pending ids Polar counts, with the snapshot that counts them."""
    # Its own session in REPEATABLE READ (see comment in service.py)
    # so that the ids and the totals come from one snapshot.
    async with sessionmaker() as session:
        return await outpost_service.confirm(session, auth_subject.subject, payload)


@router.post("/telemetry", include_in_schema=False)
async def telemetry(
    auth_subject: OutpostWrite,
    body: Annotated[bytes, Body(media_type="application/x-protobuf")],
) -> Response:
    forwarded = await anyio.to_thread.run_sync(
        outpost_service.relay_telemetry, auth_subject.subject, body
    )
    return Response(
        content=forwarded.content,
        status_code=forwarded.status_code,
        headers=dict(forwarded.headers),
    )


@router.post("/telemetry/metrics", include_in_schema=False)
async def telemetry_metrics(
    auth_subject: OutpostWrite,
    body: Annotated[bytes, Body(media_type="application/x-protobuf")],
) -> Response:
    forwarded = await anyio.to_thread.run_sync(
        outpost_service.relay_metrics, auth_subject.subject, body
    )
    return Response(
        content=forwarded.content,
        status_code=forwarded.status_code,
        headers=dict(forwarded.headers),
    )
