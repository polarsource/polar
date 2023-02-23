import asyncio
import uuid

import structlog
from fastapi import APIRouter, Depends
from polar.api.deps import current_active_user, get_redis
from polar.event import Receivers
from polar.models import User
from polar.redis import Redis
from sse_starlette.sse import EventSourceResponse

router = APIRouter(prefix="/stream", tags=["stream"])

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
            await asyncio.sleep(1)


@router.get("/events/{organization_id}")
async def listen(
    organization_id: uuid.UUID,
    user: User = Depends(current_active_user),
    redis: Redis = Depends(get_redis),
) -> EventSourceResponse:
    # TODO: Improve how we capture the organization_id and repo_id etc
    receivers = Receivers(user_id=user.id, organization_id=organization_id)
    return EventSourceResponse(subscribe(redis, receivers.get_channels()))
