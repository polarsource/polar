import json
from collections.abc import Sequence
from functools import partial
from typing import Any

import structlog

from polar.config import settings
from polar.logging import Logger
from polar.models import Event
from polar.models.event import EventSource

from .client import client
from .schemas import TinybirdEvent

log: Logger = structlog.get_logger()

DATASOURCE_EVENTS = "events_by_ingested_at"


def _pop_system_metadata(m: dict[str, Any], is_system: bool, key: str) -> Any:
    return m.pop(key, None) if is_system else None


def _event_to_tinybird(event: Event) -> TinybirdEvent:
    m = dict(event.user_metadata or {})
    cost = m.pop("_cost", None) or {}
    llm = m.pop("_llm", None) or {}

    is_system = event.source == EventSource.system
    pop = partial(_pop_system_metadata, m, is_system)

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
        meter_id=pop("meter_id"),
        units=pop("units"),
        rollover=pop("rollover"),
        product_id=pop("product_id"),
        subscription_id=pop("subscription_id"),
        order_id=pop("order_id"),
        benefit_id=pop("benefit_id"),
        benefit_grant_id=pop("benefit_grant_id"),
        checkout_id=pop("checkout_id"),
        transaction_id=pop("transaction_id"),
        refund_id=pop("refund_id"),
        dispute_id=pop("dispute_id"),
        discount_id=pop("discount_id"),
        amount=pop("amount"),
        currency=pop("currency"),
        net_amount=pop("net_amount"),
        tax_amount=pop("tax_amount"),
        discount_amount=pop("discount_amount"),
        applied_balance_amount=pop("applied_balance_amount"),
        platform_fee=pop("platform_fee"),
        fee=pop("fee"),
        refunded_amount=pop("refunded_amount"),
        refundable_amount=pop("refundable_amount"),
        presentment_amount=pop("presentment_amount"),
        presentment_currency=pop("presentment_currency"),
        recurring_interval=pop("recurring_interval"),
        recurring_interval_count=pop("recurring_interval_count"),
        old_product_id=pop("old_product_id"),
        new_product_id=pop("new_product_id"),
        old_seats=pop("old_seats"),
        new_seats=pop("new_seats"),
        started_at=pop("started_at"),
        canceled_at=pop("canceled_at"),
        ends_at=pop("ends_at"),
        old_period_end=pop("old_period_end"),
        new_period_end=pop("new_period_end"),
        cancel_at_period_end=pop("cancel_at_period_end"),
        customer_cancellation_reason=pop("customer_cancellation_reason"),
        customer_cancellation_comment=pop("customer_cancellation_comment"),
        proration_behavior=pop("proration_behavior"),
        benefit_type=pop("benefit_type"),
        billing_type=pop("billing_type"),
        checkout_status=pop("checkout_status"),
        customer_email=pop("customer_email"),
        customer_name=pop("customer_name"),
        tax_state=pop("tax_state"),
        tax_country=pop("tax_country"),
        cost_amount=cost.get("amount"),
        cost_currency=cost.get("currency"),
        llm_vendor=llm.get("vendor"),
        llm_model=llm.get("model"),
        llm_input_tokens=llm.get("input_tokens"),
        llm_output_tokens=llm.get("output_tokens"),
        user_metadata=json.dumps(m) if m else "{}",
    )


async def ingest_events(events: Sequence[Event]) -> None:
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
