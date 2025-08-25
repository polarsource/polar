import asyncio
from collections.abc import AsyncGenerator
from typing import Any

import structlog
from fastapi import Depends, Request
from redis.exceptions import ConnectionError
from sse_starlette.sse import EventSourceResponse
from uvicorn import Server

from polar.auth.dependencies import WebUserRead
from polar.exceptions import ResourceNotFound
from polar.organization.schemas import OrganizationID
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.redis import Redis, get_redis
from polar.routing import APIRouter

from .service import Receivers

router = APIRouter(prefix="/stream", tags=["stream"], include_in_schema=False)

log = structlog.get_logger()


def _uvicorn_should_exit() -> bool:
    """
    Hacky way to check if Uvicorn server is shutting down, by retrieving
    it from the running asyncio tasks.

    We do this because the exit signal handler monkey-patch made by sse_starlette
    doesn't work when running Uvicorn from the CLI,
    preventing a graceful shutdown when a SSE connection is open.
    """
    try:
        for task in asyncio.all_tasks():
            coroutine = task.get_coro()
            if coroutine is not None:
                frame = coroutine.cr_frame  # type: ignore
                if frame is not None:
                    args = frame.f_locals
                    if self := args.get("self"):
                        if isinstance(self, Server):
                            return self.should_exit
    except RuntimeError:
        pass
    return False


async def subscribe(
    redis: Redis,
    channels: list[str],
    request: Request,
) -> AsyncGenerator[Any, Any]:
    async with redis.pubsub() as pubsub:
        await pubsub.subscribe(*channels)

        while not _uvicorn_should_exit():
            if await request.is_disconnected():
                await pubsub.close()
                break

            try:
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True,
                    # Waits for up to 10s for a new message
                    timeout=10.0,
                )

                if message is not None:
                    log.info("redis.pubsub", message=message["data"])
                    yield message["data"]
            except asyncio.CancelledError as e:
                await pubsub.close()
                raise e
            except ConnectionError as e:
                await pubsub.close()
                raise e


@router.get("/user")
async def user_stream(
    request: Request,
    auth_subject: WebUserRead,
    redis: Redis = Depends(get_redis),
) -> EventSourceResponse:
    receivers = Receivers(user_id=auth_subject.subject.id)
    return EventSourceResponse(subscribe(redis, receivers.get_channels(), request))


@router.get("/organizations/{id}")
async def org_stream(
    id: OrganizationID,
    request: Request,
    auth_subject: WebUserRead,
    redis: Redis = Depends(get_redis),
    session: AsyncSession = Depends(get_db_session),
) -> EventSourceResponse:
    organization = await organization_service.get(session, auth_subject, id)
    if organization is None:
        raise ResourceNotFound()

    receivers = Receivers(
        user_id=auth_subject.subject.id, organization_id=organization.id
    )
    return EventSourceResponse(subscribe(redis, receivers.get_channels(), request))
