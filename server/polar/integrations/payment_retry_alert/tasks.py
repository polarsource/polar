import uuid
from typing import Annotated

from polar.external_event.service import external_event as external_event_service
from polar.models.external_event import ExternalEventSource
from polar.observability.task_logging import LoggableField
from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .service import payment_retry_alert as payment_retry_alert_service


@actor(
    actor_name="payment_retry_alert.webhook.alert.created",
    priority=TaskPriority.MEDIUM,
)
async def alert_created(event_id: Annotated[uuid.UUID, LoggableField]) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle(
            session, ExternalEventSource.payment_retry_alert, event_id
        ) as event:
            await payment_retry_alert_service.handle_alert(
                session, event.data["data"]["object"]
            )
