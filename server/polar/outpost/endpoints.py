from contextlib import aclosing

import structlog
from anyio import create_memory_object_stream, create_task_group
from anyio.streams.memory import MemoryObjectReceiveStream, MemoryObjectSendStream
from fastapi import Depends, WebSocket

from polar.kit.db.postgres import AsyncSessionMaker
from polar.logging import Logger
from polar.models import Organization
from polar.openapi import APITag
from polar.redis import Redis, get_redis
from polar.routing import APIRouter

from . import stream
from .auth import authenticate
from .schemas import OutgoingMessage
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
async def outpost(websocket: WebSocket, redis: Redis = Depends(get_redis)) -> None:
    auth_subject = await authenticate(websocket)
    if auth_subject is None:
        return

    sessionmaker: AsyncSessionMaker = websocket.state.async_sessionmaker

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
