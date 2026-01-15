import structlog

from polar.config import settings
from polar.logging import Logger
from polar.models import Event

from .client import client
from .schemas import TinybirdEvent

log: Logger = structlog.get_logger()

DATASOURCE_EVENTS = "events"


def _event_to_tinybird(event: Event) -> TinybirdEvent:
    metadata = event.user_metadata or {}
    return TinybirdEvent(
        id=str(event.id),
        ingested_at=event.ingested_at.isoformat(),
        timestamp=event.timestamp.isoformat(),
        name=event.name,
        source=event.source,
        organization_id=str(event.organization_id),
        customer_id=str(event.customer_id) if event.customer_id else None,
        external_customer_id=event.external_customer_id,
        external_id=event.external_id,
        parent_id=str(event.parent_id) if event.parent_id else None,
        root_id=str(event.root_id) if event.root_id else None,
        event_type_id=str(event.event_type_id) if event.event_type_id else None,
        meter_id=metadata.get("meter_id"),
        units=metadata.get("units"),
        product_id=metadata.get("product_id"),
        subscription_id=metadata.get("subscription_id"),
        order_id=metadata.get("order_id"),
        amount=metadata.get("amount"),
        currency=metadata.get("currency"),
        user_metadata=metadata,
    )


async def ingest_events(events: list[Event]) -> None:
    if not settings.TINYBIRD_EVENTS_WRITE:
        return

    if not events:
        return

    try:
        tinybird_events = [_event_to_tinybird(e) for e in events]
        await client.ingest(DATASOURCE_EVENTS, tinybird_events)
    except Exception as e:
        log.error(
            "tinybird.ingest_events.failed", error=str(e), event_count=len(events)
        )
