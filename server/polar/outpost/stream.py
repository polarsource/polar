import collections.abc
import datetime
import json
import typing
import uuid

import anyio

from polar.kit.json import json_obj_serializer
from polar.redis import Redis
from polar.worker import JobQueueManager


class ReducerBucketOutpostEvent(typing.TypedDict):
    type: typing.Literal["reducer_bucket"]
    reducer_id: uuid.UUID
    customer_id: uuid.UUID | None
    external_customer_id: str | None


type OutpostEvent = ReducerBucketOutpostEvent


# A cursor older than this has missed changes: the client starts over.
CHANGES_RETENTION = datetime.timedelta(hours=1)


def _get_channel(organization_id: uuid.UUID) -> str:
    return f"outpost:{organization_id}"


def get_changes_key(organization_id: uuid.UUID) -> str:
    return f"outpost:changes:{organization_id}"


def _encode(event: OutpostEvent) -> str:
    return json.dumps(event, default=json_obj_serializer)


async def publish(
    redis: Redis,
    organization_id: uuid.UUID,
    event: OutpostEvent,
) -> None:
    await redis.publish(_get_channel(organization_id), _encode(event))


def enqueue(organization_id: uuid.UUID, event: OutpostEvent) -> None:
    """Publish the event and append it to the organization's changes once the
    transaction committed."""
    job_queue_manager = JobQueueManager.get()
    job_queue_manager.publish(_get_channel(organization_id), _encode(event))
    job_queue_manager.append(
        get_changes_key(organization_id),
        {"event": _encode(event)},
        retention=CHANGES_RETENTION,
    )


async def subscribe(
    redis: Redis,
    organization_id: uuid.UUID,
) -> collections.abc.AsyncGenerator[OutpostEvent]:
    pubsub = redis.pubsub()
    try:
        await pubsub.subscribe(_get_channel(organization_id))
        while True:
            message = await pubsub.get_message(
                ignore_subscribe_messages=True, timeout=1.0
            )
            if message is not None:
                yield json.loads(message["data"])
    finally:
        with anyio.CancelScope(shield=True):
            await pubsub.close()
