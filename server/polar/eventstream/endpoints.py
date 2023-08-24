import asyncio
from typing import Any, AsyncGenerator

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from redis.exceptions import ConnectionError
from sse_starlette.sse import EventSourceResponse

from polar.auth.dependencies import Auth
from polar.enums import Platforms
from polar.redis import Redis, get_redis

from .service import Receivers

router = APIRouter(tags=["stream"])

log = structlog.get_logger()


async def subscribe(
    redis: Redis,
    channels: list[str],
    request: Request,
) -> AsyncGenerator[Any, Any]:
    async with redis.pubsub() as pubsub:
        await pubsub.subscribe(*channels)

        while True:
            if await request.is_disconnected():
                await pubsub.close()
                break

            try:
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True,
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


@router.get("/user/stream")
async def user_stream(
    request: Request,
    auth: Auth = Depends(Auth.current_user),
    redis: Redis = Depends(get_redis),
) -> EventSourceResponse:
    if not auth.user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    receivers = Receivers(user_id=auth.user.id)
    return EventSourceResponse(subscribe(redis, receivers.get_channels(), request))


@router.get("/{platform}/{org_name}/stream")
async def user_org_stream(
    platform: Platforms,
    org_name: str,
    request: Request,
    auth: Auth = Depends(Auth.user_with_org_access),
    redis: Redis = Depends(get_redis),
) -> EventSourceResponse:
    if not auth.user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    receivers = Receivers(user_id=auth.user.id, organization_id=auth.organization.id)
    return EventSourceResponse(subscribe(redis, receivers.get_channels(), request))


@router.get("/{platform}/{org_name}/{repo_name}/stream")
async def user_org_repo_stream(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    request: Request,
    auth: Auth = Depends(Auth.user_with_org_and_repo_access),
    redis: Redis = Depends(get_redis),
) -> EventSourceResponse:
    if not auth.user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    receivers = Receivers(
        user_id=auth.user.id,
        organization_id=auth.organization.id,
        repository_id=auth.repository.id,
    )
    return EventSourceResponse(subscribe(redis, receivers.get_channels(), request))
