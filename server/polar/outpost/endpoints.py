import uuid
from contextlib import aclosing
from typing import Annotated

import anyio.to_thread
import structlog
from anyio import Semaphore, create_memory_object_stream, create_task_group
from anyio.streams.memory import MemoryObjectReceiveStream, MemoryObjectSendStream
from fastapi import Body, Depends, Query, Response, WebSocket

from polar.exceptions import ResourceNotFound
from polar.kit.db.postgres import AsyncSessionMaker
from polar.logging import Logger
from polar.models import Organization
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session, get_db_sessionmaker
from polar.redis import Redis, get_redis
from polar.routing import APIRouter

from . import stream
from .auth import OutpostWrite
from .schemas import (
    Changes,
    ConfigurationOutgoingMessagePayload,
    ConfirmedOutgoingMessagePayload,
    ConfirmIncomingMessagePayload,
    ConnectionOutgoingMessage,
    ConnectionOutgoingMessagePayload,
    MeterUsageIncomingPayload,
    MeterUsageOutgoingMessagePayload,
    OutgoingMessage,
    OutgoingMessageType,
)
from .service import outpost as outpost_service

log: Logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/outpost", tags=["outpost", APITag.private])

# Requests one connection handles at once, each in its own session.
CONCURRENT_REQUESTS = 4


async def send_messages(
    websocket: WebSocket, receive_stream: MemoryObjectReceiveStream[OutgoingMessage]
) -> None:
    async with receive_stream:
        async for message in receive_stream:
            log.debug("Sending message", type=message.type)
            await websocket.send_text(message.model_dump_json())


async def handle_messages(
    organization: Organization,
    sessionmaker: AsyncSessionMaker,
    incoming_receive_stream: MemoryObjectReceiveStream[str],
    outgoing_send_stream: MemoryObjectSendStream[OutgoingMessage],
) -> None:
    semaphore = Semaphore(CONCURRENT_REQUESTS)

    async def handle_message(payload: str) -> None:
        try:
            async with sessionmaker() as session:
                await outpost_service.handle_incoming_message(
                    session, organization, payload, outgoing_send_stream
                )
        finally:
            semaphore.release()

    async with (
        incoming_receive_stream,
        outgoing_send_stream,
        create_task_group() as task_group,
    ):
        async for payload in incoming_receive_stream:
            await semaphore.acquire()
            task_group.start_soon(handle_message, payload)


async def handle_events(
    redis: Redis,
    sessionmaker: AsyncSessionMaker,
    organization: Organization,
    outgoing_send_stream: MemoryObjectSendStream[OutgoingMessage],
) -> None:
    async with (
        outgoing_send_stream,
        aclosing(stream.subscribe(redis, organization.id)) as events,
    ):
        async for event in events:
            async with sessionmaker() as session:
                await outpost_service.handle_event(
                    session, organization, event, outgoing_send_stream
                )


@router.websocket("/")
async def outpost(
    websocket: WebSocket,
    auth_subject: OutpostWrite,
    redis: Redis = Depends(get_redis),
) -> None:
    await websocket.accept()
    log.debug("WebSocket connection accepted", subject_id=auth_subject.subject.id)

    sessionmaker: AsyncSessionMaker = websocket.state.async_sessionmaker
    connection_id = uuid.uuid4()
    structlog.contextvars.bind_contextvars(outpost_connection_id=str(connection_id))

    incoming_send_stream, incoming_receive_stream = create_memory_object_stream[str](16)
    outgoing_send_stream, outgoing_receive_stream = create_memory_object_stream[
        OutgoingMessage
    ]()
    async with (
        incoming_send_stream,
        incoming_receive_stream,
        outgoing_send_stream,
        outgoing_receive_stream,
        create_task_group() as task_group,
    ):
        task_group.start_soon(send_messages, websocket, outgoing_receive_stream)
        await outgoing_send_stream.send(
            ConnectionOutgoingMessage(
                type=OutgoingMessageType.connection,
                payload=ConnectionOutgoingMessagePayload(id=connection_id),
            )
        )
        task_group.start_soon(
            handle_events,
            redis,
            sessionmaker,
            auth_subject.subject,
            outgoing_send_stream.clone(),
        )
        task_group.start_soon(
            handle_messages,
            auth_subject.subject,
            sessionmaker,
            incoming_receive_stream,
            outgoing_send_stream.clone(),
        )
        async for payload in websocket.iter_text():
            await incoming_send_stream.send(payload)
        task_group.cancel_scope.cancel()


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


@router.get("/configuration", response_model=ConfigurationOutgoingMessagePayload)
async def configuration(
    auth_subject: OutpostWrite,
    session: AsyncSession = Depends(get_db_session),
) -> ConfigurationOutgoingMessagePayload:
    """The reducers Outpost runs."""
    return await outpost_service.get_configuration(session, auth_subject.subject)


@router.post(
    "/meter-usage",
    response_model=list[MeterUsageOutgoingMessagePayload],
    responses={404: ReducerNotFound},
)
async def meter_usage(
    payload: MeterUsageIncomingPayload,
    auth_subject: OutpostWrite,
    session: AsyncSession = Depends(get_db_session),
) -> list[MeterUsageOutgoingMessagePayload]:
    """The snapshot of every identity of each requested customer."""
    return await outpost_service.get_requested_meter_usage(
        session, auth_subject.subject, payload.identities
    )


@router.post(
    "/confirm",
    response_model=ConfirmedOutgoingMessagePayload,
    responses={404: ReducerNotFound},
)
async def confirm(
    payload: ConfirmIncomingMessagePayload,
    auth_subject: OutpostWrite,
    sessionmaker: AsyncSessionMaker = Depends(get_db_sessionmaker),
) -> ConfirmedOutgoingMessagePayload:
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
