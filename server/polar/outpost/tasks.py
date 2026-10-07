import typing
import uuid

from polar.observability.task_logging import LoggableField
from polar.worker import RedisMiddleware, TaskPriority, actor

from .stream import OutpostEvent, publish


@actor(actor_name="outpost.publish", priority=TaskPriority.HIGH)
async def outpost_publish(
    organization_id: typing.Annotated[uuid.UUID, LoggableField],
    **event: typing.Unpack[OutpostEvent],
) -> None:
    await publish(RedisMiddleware.get(), organization_id, **event)
