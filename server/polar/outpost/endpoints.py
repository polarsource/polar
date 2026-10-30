import uuid
from contextlib import aclosing
from typing import Annotated

import anyio.to_thread
import structlog
from anyio import create_memory_object_stream, create_task_group
from anyio.streams.memory import MemoryObjectReceiveStream, MemoryObjectSendStream
from fastapi import Body, Depends, Response, WebSocket

from polar.kit.db.postgres import AsyncSessionMaker
from polar.logging import Logger
from polar.models import Organization
from polar.openapi import APITag
from polar.redis import Redis, get_redis
from polar.routing import APIRouter

from . import stream
from .auth import OutpostWrite
from .schemas import (
    ConnectionOutgoingMessage,
    ConnectionOutgoingMessagePayload,
    OutgoingMessage,
    OutgoingMessageType,
)
from .service import outpost as outpost_service

log: Logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/outpost", tags=["outpost", APITag.private])


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
    async with incoming_receive_stream, outgoing_send_stream:
        async for payload in incoming_receive_stream:
            async with sessionmaker() as session:
                await outpost_service.handle_incoming_message(
                    session, organization, payload, outgoing_send_stream
                )


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
