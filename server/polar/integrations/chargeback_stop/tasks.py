import uuid

from polar.dispute.service import dispute as dispute_service
from polar.external_event.service import external_event as external_event_service
from polar.models.external_event import ExternalEventSource
from polar.worker import AsyncSessionMaker, TaskPriority, actor


@actor(actor_name="chargeback_stop.webhook.alert.created", priority=TaskPriority.HIGH)
async def alert_created(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle(
            session, ExternalEventSource.chargeback_stop, event_id
        ) as event:
            await dispute_service.upsert_from_chargeback_stop(
                session, event.data["data"]["object"]
            )


@actor(actor_name="chargeback_stop.webhook.alert.updated", priority=TaskPriority.HIGH)
async def alert_updated(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle(
            session, ExternalEventSource.chargeback_stop, event_id
        ) as event:
            await dispute_service.upsert_from_chargeback_stop(
                session, event.data["data"]["object"]
            )
