import json
from collections.abc import Sequence

import structlog

from polar.config import settings
from polar.logging import Logger
from polar.models import Event

from .client import client
from .schemas import TinybirdEvent

log: Logger = structlog.get_logger()

DATASOURCE_EVENTS = "events_by_ingested_at"


def _event_to_tinybird(event: Event) -> TinybirdEvent:
    m = dict(event.user_metadata or {})
    cost = m.pop("_cost", None) or {}
    llm = m.pop("_llm", None) or {}

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
        meter_id=m.pop("meter_id", None),
        units=m.pop("units", None),
        rollover=m.pop("rollover", None),
        product_id=m.pop("product_id", None),
        subscription_id=m.pop("subscription_id", None),
        order_id=m.pop("order_id", None),
        benefit_id=m.pop("benefit_id", None),
        benefit_grant_id=m.pop("benefit_grant_id", None),
        checkout_id=m.pop("checkout_id", None),
        transaction_id=m.pop("transaction_id", None),
        refund_id=m.pop("refund_id", None),
        dispute_id=m.pop("dispute_id", None),
        discount_id=m.pop("discount_id", None),
        amount=m.pop("amount", None),
        currency=m.pop("currency", None),
        net_amount=m.pop("net_amount", None),
        tax_amount=m.pop("tax_amount", None),
        discount_amount=m.pop("discount_amount", None),
        applied_balance_amount=m.pop("applied_balance_amount", None),
        platform_fee=m.pop("platform_fee", None),
        fee=m.pop("fee", None),
        refunded_amount=m.pop("refunded_amount", None),
        refundable_amount=m.pop("refundable_amount", None),
        presentment_amount=m.pop("presentment_amount", None),
        presentment_currency=m.pop("presentment_currency", None),
        recurring_interval=m.pop("recurring_interval", None),
        recurring_interval_count=m.pop("recurring_interval_count", None),
        old_product_id=m.pop("old_product_id", None),
        new_product_id=m.pop("new_product_id", None),
        old_seats=m.pop("old_seats", None),
        new_seats=m.pop("new_seats", None),
        started_at=m.pop("started_at", None),
        canceled_at=m.pop("canceled_at", None),
        ends_at=m.pop("ends_at", None),
        old_period_end=m.pop("old_period_end", None),
        new_period_end=m.pop("new_period_end", None),
        cancel_at_period_end=m.pop("cancel_at_period_end", None),
        customer_cancellation_reason=m.pop("customer_cancellation_reason", None),
        customer_cancellation_comment=m.pop("customer_cancellation_comment", None),
        proration_behavior=m.pop("proration_behavior", None),
        benefit_type=m.pop("benefit_type", None),
        billing_type=m.pop("billing_type", None),
        checkout_status=m.pop("checkout_status", None),
        customer_email=m.pop("customer_email", None),
        customer_name=m.pop("customer_name", None),
        tax_state=m.pop("tax_state", None),
        tax_country=m.pop("tax_country", None),
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
