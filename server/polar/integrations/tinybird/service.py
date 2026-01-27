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
    metadata = event.user_metadata or {}
    cost = metadata.get("_cost") or {}
    llm = metadata.get("_llm") or {}

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
        # Meter fields
        meter_id=metadata.get("meter_id"),
        units=metadata.get("units"),
        rollover=metadata.get("rollover"),
        # Core entity IDs
        product_id=metadata.get("product_id"),
        subscription_id=metadata.get("subscription_id"),
        order_id=metadata.get("order_id"),
        benefit_id=metadata.get("benefit_id"),
        benefit_grant_id=metadata.get("benefit_grant_id"),
        checkout_id=metadata.get("checkout_id"),
        transaction_id=metadata.get("transaction_id"),
        refund_id=metadata.get("refund_id"),
        dispute_id=metadata.get("dispute_id"),
        discount_id=metadata.get("discount_id"),
        # Financial fields
        amount=metadata.get("amount"),
        currency=metadata.get("currency"),
        net_amount=metadata.get("net_amount"),
        tax_amount=metadata.get("tax_amount"),
        discount_amount=metadata.get("discount_amount"),
        applied_balance_amount=metadata.get("applied_balance_amount"),
        platform_fee=metadata.get("platform_fee"),
        fee=metadata.get("fee"),
        refunded_amount=metadata.get("refunded_amount"),
        refundable_amount=metadata.get("refundable_amount"),
        presentment_amount=metadata.get("presentment_amount"),
        presentment_currency=metadata.get("presentment_currency"),
        # Subscription fields
        recurring_interval=metadata.get("recurring_interval"),
        recurring_interval_count=metadata.get("recurring_interval_count"),
        old_product_id=metadata.get("old_product_id"),
        new_product_id=metadata.get("new_product_id"),
        old_seats=metadata.get("old_seats"),
        new_seats=metadata.get("new_seats"),
        started_at=metadata.get("started_at"),
        canceled_at=metadata.get("canceled_at"),
        ends_at=metadata.get("ends_at"),
        old_period_end=metadata.get("old_period_end"),
        new_period_end=metadata.get("new_period_end"),
        cancel_at_period_end=metadata.get("cancel_at_period_end"),
        customer_cancellation_reason=metadata.get("customer_cancellation_reason"),
        customer_cancellation_comment=metadata.get("customer_cancellation_comment"),
        proration_behavior=metadata.get("proration_behavior"),
        # Type/enum fields
        benefit_type=metadata.get("benefit_type"),
        billing_type=metadata.get("billing_type"),
        checkout_status=metadata.get("checkout_status"),
        # Customer fields
        customer_email=metadata.get("customer_email"),
        customer_name=metadata.get("customer_name"),
        # Tax fields
        tax_state=metadata.get("tax_state"),
        tax_country=metadata.get("tax_country"),
        # User event fields (_cost, _llm)
        cost_amount=cost.get("amount") if cost else None,
        cost_currency=cost.get("currency") if cost else None,
        llm_vendor=llm.get("vendor") if llm else None,
        llm_model=llm.get("model") if llm else None,
        llm_input_tokens=llm.get("input_tokens") if llm else None,
        llm_output_tokens=llm.get("output_tokens") if llm else None,
        # Remaining metadata as JSON string
        user_metadata=json.dumps(metadata),
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
