import asyncio
from collections.abc import AsyncGenerator, Awaitable, Callable
from typing import Any

import structlog
from fastapi import Depends, Request
from redis.exceptions import ConnectionError
from sse_starlette.sse import EventSourceResponse
from uvicorn import Server

from polar.auth.models import is_user
from polar.authz.dependencies import AuthorizeOrgAccess, AuthorizeWebUserRead
from polar.observability import HTTP_SSE_CONNECTIONS_OPENED
from polar.observability.utils import get_path_template
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


# Maximum lifetime for a single SSE connection.
# After this duration the server sends a "reconnect" event and closes the connection,
# forcing the client to reconnect. This caps steady-state memory growth caused by
# long-lived connections holding DB sessions and Redis subscriptions indefinitely.
MAX_SSE_CONNECTION_LIFETIME = 10 * 60  # 10 minutes


async def subscribe(
    redis: Redis,
    channels: list[str],
    request: Request,
    on_iteration: Callable[[], Awaitable[None]] | None = None,
) -> AsyncGenerator[Any, Any]:
    deadline = asyncio.get_event_loop().time() + MAX_SSE_CONNECTION_LIFETIME

    async with redis.pubsub() as pubsub:
        await pubsub.subscribe(*channels)

        endpoint = get_path_template(request.scope)
        if endpoint is not None:
            HTTP_SSE_CONNECTIONS_OPENED.labels(endpoint=endpoint).inc()

        try:
            while not _uvicorn_should_exit():
                if await request.is_disconnected():
                    break

                # Enforce maximum connection lifetime
                remaining = deadline - asyncio.get_event_loop().time()
                if remaining <= 0:
                    yield '{"type": "reconnect"}'
                    break

                if on_iteration is not None:
                    await on_iteration()

                try:
                    message = await pubsub.get_message(
                        ignore_subscribe_messages=True,
                        # Waits for up to 1s for a new message (shorter interval
                        # reduces disconnect detection latency from 10s to ~1s)
                        timeout=min(1.0, remaining),
                    )

                    if message is not None:
                        log.debug("redis.pubsub", message=message["data"])
                        yield message["data"]
                except asyncio.CancelledError:
                    raise
                except ConnectionError:
                    raise
        finally:
            if endpoint is not None:
                HTTP_SSE_CONNECTIONS_OPENED.labels(endpoint=endpoint).dec()


@router.get("/user")
async def user_stream(
    request: Request,
    auth_subject: AuthorizeWebUserRead,
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> EventSourceResponse:
    await session.commit()
    receivers = Receivers(user_id=auth_subject.subject.id)
    return EventSourceResponse(subscribe(redis, receivers.get_channels(), request))


@router.get("/organizations/{id}")
async def org_stream(
    request: Request,
    authz: AuthorizeOrgAccess,
    redis: Redis = Depends(get_redis),
    session: AsyncSession = Depends(get_db_session),
) -> EventSourceResponse:
    await session.commit()

    user_id = authz.auth_subject.subject.id if is_user(authz.auth_subject) else None
    receivers = Receivers(user_id=user_id, organization_id=authz.organization.id)
    return EventSourceResponse(subscribe(redis, receivers.get_channels(), request))
