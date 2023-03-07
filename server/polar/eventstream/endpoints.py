import asyncio

import structlog
from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from polar.auth.dependencies import current_active_user
from polar.redis import get_redis
from polar.models import User
from polar.redis import Redis

from .service import Receivers

router = APIRouter()

log = structlog.get_logger()


async def subscribe(redis: Redis, channels: list[str]):
    async with redis.pubsub() as pubsub:
        await pubsub.subscribe(*channels)

        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True)
            if message is not None:
                log.info("redis.pubsub", message=message["data"])
                yield message["data"]

            # TODO: Move this to a configuration setting
            await asyncio.sleep(0.1)


@router.get("")
async def listen(
    organization_id: str | None,
    repository_id: str | None = None,
    user: User = Depends(current_active_user),
    redis: Redis = Depends(get_redis),
) -> EventSourceResponse:
    # TODO(Security): Validate user & org+repo relationships here!
    receivers = Receivers(
        user_id=user.id, organization_id=organization_id, repository_id=repository_id
    )
    return EventSourceResponse(subscribe(redis, receivers.get_channels()))
