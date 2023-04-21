import asyncio

import structlog
from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from polar.enums import Platforms
from polar.auth.dependencies import Auth
from polar.redis import get_redis
from polar.redis import Redis

from .service import Receivers

router = APIRouter(tags=["stream"])

log = structlog.get_logger()


async def subscribe(redis: Redis, channels: list[str]):
    async with redis.pubsub() as pubsub:
        await pubsub.subscribe(*channels)

        while True:
            message = await pubsub.get_message(
                ignore_subscribe_messages=True, timeout=30.0
            )

            if message is not None:
                log.info("redis.pubsub", message=message["data"])
                yield message["data"]


@router.get("/user/stream")
async def user_stream(
    auth: Auth = Depends(Auth.current_user),
    redis: Redis = Depends(get_redis),
) -> EventSourceResponse:
    receivers = Receivers(user_id=auth.user.id)
    return EventSourceResponse(subscribe(redis, receivers.get_channels()))


@router.get("/{platform}/{org_name}/stream")
async def user_org_stream(
    platform: Platforms,
    org_name: str,
    auth: Auth = Depends(Auth.user_with_org_access),
    redis: Redis = Depends(get_redis),
) -> EventSourceResponse:
    receivers = Receivers(user_id=auth.user.id, organization_id=auth.organization.id)
    return EventSourceResponse(subscribe(redis, receivers.get_channels()))


@router.get("/{platform}/{org_name}/{repo_name}/stream")
async def user_org_repo_stream(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    auth: Auth = Depends(Auth.user_with_org_and_repo_access),
    redis: Redis = Depends(get_redis),
) -> EventSourceResponse:
    receivers = Receivers(
        user_id=auth.user.id,
        organization_id=auth.organization.id,
        repository_id=auth.repository.id,
    )
    return EventSourceResponse(subscribe(redis, receivers.get_channels()))
