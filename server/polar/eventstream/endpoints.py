import asyncio
from collections.abc import AsyncGenerator, AsyncIterable, Awaitable, Callable
from typing import Any

import structlog
from fastapi import Depends, Request
from redis.exceptions import ConnectionError
from sse_starlette.sse import AppStatus, EventSourceResponse

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


# Maximum lifetime for a single SSE connection.
# After this duration the server sends a "reconnect" event and closes the connection,
# forcing the client to reconnect. This caps steady-state memory growth caused by
# long-lived connections holding DB sessions and Redis subscriptions indefinitely.
MAX_SSE_CONNECTION_LIFETIME = 10 * 60  # 10 minutes

# How long `subscribe` gets to end on its own once the server shuts down,
# before sse_starlette cancels it. Must stay below Uvicorn's graceful shutdown timeout.
SHUTDOWN_GRACE_PERIOD = 5


class SubscribeResponse(EventSourceResponse):
    def __init__(self, content: AsyncIterable[Any]) -> None:
        super().__init__(content, shutdown_grace_period=SHUTDOWN_GRACE_PERIOD)


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
            while True:
                if await request.is_disconnected():
                    break

                # Enforce maximum connection lifetime, and hand the client
                # over to another server process when this one shuts down
                remaining = deadline - asyncio.get_event_loop().time()
                if remaining <= 0 or AppStatus.should_exit:
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
                        log.debug(
                            "redis.pubsub",
                            message_char_count=len(message["data"]),
                            channel_count=len(channels),
                        )
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
) -> SubscribeResponse:
    await session.commit()
    receivers = Receivers(user_id=auth_subject.subject.id)
    return SubscribeResponse(subscribe(redis, receivers.get_channels(), request))


@router.get("/organizations/{id}")
async def org_stream(
    request: Request,
    authz: AuthorizeOrgAccess,
    redis: Redis = Depends(get_redis),
    session: AsyncSession = Depends(get_db_session),
) -> SubscribeResponse:
    await session.commit()

    user_id = authz.auth_subject.subject.id if is_user(authz.auth_subject) else None
    receivers = Receivers(user_id=user_id, organization_id=authz.organization.id)
    return SubscribeResponse(subscribe(redis, receivers.get_channels(), request))
