import collections.abc
import json
import typing
import uuid

import anyio

from polar.kit.json import json_obj_serializer
from polar.redis import Redis
from polar.worker import enqueue_job


class CustomerMeterOutpostEvent(typing.TypedDict):
    type: typing.Literal["customer_meter"]
    customer_id: uuid.UUID
    meter_id: uuid.UUID


type OutpostEvent = CustomerMeterOutpostEvent


async def publish(
    redis: Redis,
    organization_id: uuid.UUID,
    **event: typing.Unpack[OutpostEvent],
) -> None:
    await redis.publish(
        f"outpost:{organization_id}", json.dumps(event, default=json_obj_serializer)
    )


def enqueue(organization_id: uuid.UUID, **event: typing.Unpack[OutpostEvent]) -> None:
    enqueue_job(
        "outpost.publish",
        organization_id=organization_id,
        **event,  # pyright: ignore
    )


async def subscribe(
    redis: Redis,
    organization_id: uuid.UUID,
) -> collections.abc.AsyncGenerator[OutpostEvent]:
    pubsub = redis.pubsub()
    try:
        await pubsub.subscribe(f"outpost:{organization_id}")
        while True:
            message = await pubsub.get_message(
                ignore_subscribe_messages=True, timeout=1.0
            )
            if message is not None:
                yield json.loads(message["data"])
    finally:
        with anyio.CancelScope(shield=True):
            await pubsub.close()
