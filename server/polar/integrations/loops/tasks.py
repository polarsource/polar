from typing import Unpack

from polar.worker import TaskPriority, actor

from .client import Properties
from .client import client as loops_client


@actor(actor_name="loops.update_contact", priority=TaskPriority.LOW)
async def loops_update_contact(
    email: str, id: str, **properties: Unpack[Properties]
) -> None:
    await loops_client.update_contact(email, id, **properties)


@actor(actor_name="loops.send_event", priority=TaskPriority.LOW)
async def loops_send_event(
    email: str, event_name: str, **properties: Unpack[Properties]
) -> None:
    await loops_client.send_event(email, event_name, **properties)
