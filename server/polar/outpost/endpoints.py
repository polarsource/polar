from contextlib import aclosing

from anyio import create_memory_object_stream, create_task_group
from anyio.streams.memory import MemoryObjectReceiveStream, MemoryObjectSendStream
from fastapi import Depends, WebSocket

from polar.models import Organization
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.redis import Redis, get_redis
from polar.routing import APIRouter

from . import stream
from .auth import OutpostAuth
from .schemas import OutgoingMessage
from .service import outpost as outpost_service

router = APIRouter(prefix="/outpost", tags=["outpost", APITag.private])


async def send_messages(
    websocket: WebSocket, receive_stream: MemoryObjectReceiveStream[OutgoingMessage]
) -> None:
    async with receive_stream:
        async for message in receive_stream:
            await websocket.send_text(message.model_dump_json())


async def handle_messages(
    organization: Organization,
    session: AsyncSession,
    incoming_receive_stream: MemoryObjectReceiveStream[str],
    outgoing_send_stream: MemoryObjectSendStream[OutgoingMessage],
) -> None:
    async with incoming_receive_stream, outgoing_send_stream:
        async for payload in incoming_receive_stream:
            await outpost_service.handle_incoming_message(
                session, organization, payload, outgoing_send_stream
            )


async def handle_events(
    redis: Redis,
    organization: Organization,
    session: AsyncSession,
    outgoing_send_stream: MemoryObjectSendStream[OutgoingMessage],
) -> None:
    async with (
        outgoing_send_stream,
        aclosing(stream.subscribe(redis, organization.id)) as events,
    ):
        async for event in events:
            await outpost_service.handle_event(
                session, organization, event, outgoing_send_stream
            )


@router.websocket("/")
async def outpost(
    websocket: WebSocket,
    auth_subject: OutpostAuth,
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> None:
    await websocket.accept()
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
            auth_subject.subject,
            session,
            outgoing_send_stream.clone(),
        )
        task_group.start_soon(
            handle_messages,
            auth_subject.subject,
            session,
            incoming_receive_stream,
            outgoing_send_stream.clone(),
        )
        async for payload in websocket.iter_text():
            await incoming_send_stream.send(payload)
        task_group.cancel_scope.cancel()
    await websocket.close()
