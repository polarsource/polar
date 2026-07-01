"""Shared event builders for seeds (extracted from seeds_load.py).

Pure timeline / cost-span generators plus the event insert/flush helpers, reused
by the orders and cost_insights components and (until the cutover) by
seeds_load.py itself.
"""

from __future__ import annotations

import random
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from polar.event.system import SystemEvent as SystemEventEnum
from polar.event_type.repository import EventTypeRepository
from polar.integrations.tinybird.service import ingest_events as tinybird_ingest_events
from polar.kit.utils import generate_uuid
from polar.models.event import Event as EventModel
from polar.models.product import Product
from polar.postgres import AsyncSession

TINYBIRD_FLUSH_CHUNK = 2500


async def _flush_tinybird_events(
    events: Sequence[EventModel],
    ancestors_by_event: dict[UUID, list[str]],
) -> None:
    """Send accumulated events to Tinybird, chunked under the payload limit."""
    for start in range(0, len(events), TINYBIRD_FLUSH_CHUNK):
        await tinybird_ingest_events(
            events[start : start + TINYBIRD_FLUSH_CHUNK], ancestors_by_event
        )


async def _stamp_event_type_ids(
    session: AsyncSession, events: list[dict[str, Any]]
) -> None:
    """Stamp event_type_id on each event dict, mirroring the real ingest path."""
    event_type_repository = EventTypeRepository.from_session(session)
    cache: dict[tuple[str, Any], Any] = {}
    for event in events:
        name = event.get("name")
        org_id = event.get("organization_id")
        if not name or not org_id:
            continue
        key = (name, org_id)
        if key not in cache:
            event_type = await event_type_repository.get_or_create(name, org_id)
            cache[key] = event_type.id
        event["event_type_id"] = cache[key]


def _build_customer_timeline_events(
    organization_id: Any,
    customer_id: Any,
    customer_email: str,
    customer_name: str,
    products: list[Product],
) -> list[dict[str, Any]]:
    """Generate a realistic timeline of system events for a customer.

    Simulates a customer lifecycle: creation → checkout → subscription →
    recurring cycles with order payments → possible cancellation/refund.
    """
    events: list[dict[str, Any]] = []
    now = datetime.now(UTC)

    days_ago = random.randint(90, 540)
    timeline_start = now - timedelta(days=days_ago)

    def _evt(
        name: str, timestamp: datetime, metadata: dict[str, Any]
    ) -> dict[str, Any]:
        return {
            "name": name,
            "source": "system",
            "timestamp": timestamp,
            "organization_id": organization_id,
            "customer_id": customer_id,
            "user_metadata": metadata,
        }

    # 1. Customer created
    t = timeline_start
    events.append(
        _evt(
            SystemEventEnum.customer_created,
            t,
            {
                "customer_id": str(customer_id),
                "customer_email": customer_email,
                "customer_name": customer_name,
                "customer_external_id": None,
            },
        )
    )

    # Pick a product for this customer's subscription journey
    recurring_products = [p for p in products if p.recurring_interval is not None]
    onetime_products = [p for p in products if p.recurring_interval is None]

    # 2. Checkout created
    t += timedelta(minutes=random.randint(1, 30))
    chosen_product = random.choice(recurring_products) if recurring_products else None
    if chosen_product:
        fake_checkout_id = str(generate_uuid())
        events.append(
            _evt(
                SystemEventEnum.checkout_created,
                t,
                {
                    "checkout_id": fake_checkout_id,
                    "checkout_status": "succeeded",
                    "product_id": str(chosen_product.id),
                },
            )
        )

        # 3. Subscription created
        t += timedelta(minutes=random.randint(1, 5))
        fake_sub_id = str(generate_uuid())
        price_amount = 2900
        for p in chosen_product.all_prices:
            pa = getattr(p, "price_amount", None)
            if pa is not None:
                price_amount = pa
                break
        interval = chosen_product.recurring_interval or "month"
        events.append(
            _evt(
                SystemEventEnum.subscription_created,
                t,
                {
                    "subscription_id": fake_sub_id,
                    "product_id": str(chosen_product.id),
                    "amount": price_amount,
                    "currency": "usd",
                    "recurring_interval": str(interval),
                    "recurring_interval_count": 1,
                    "started_at": t.isoformat(),
                },
            )
        )

        # 4. Initial order paid
        t += timedelta(seconds=random.randint(1, 30))
        fake_order_id = str(generate_uuid())
        events.append(
            _evt(
                SystemEventEnum.order_paid,
                t,
                {
                    "order_id": fake_order_id,
                    "product_id": str(chosen_product.id),
                    "amount": price_amount,
                    "currency": "usd",
                    "net_amount": int(price_amount * 0.95),
                    "tax_amount": int(price_amount * 0.05),
                    "subscription_id": fake_sub_id,
                    "recurring_interval": str(interval),
                    "recurring_interval_count": 1,
                },
            )
        )

        # 5. Benefit granted (if product has benefits)
        t += timedelta(seconds=random.randint(1, 10))
        fake_benefit_id = str(generate_uuid())
        fake_grant_id = str(generate_uuid())
        events.append(
            _evt(
                SystemEventEnum.benefit_granted,
                t,
                {
                    "benefit_id": fake_benefit_id,
                    "benefit_grant_id": fake_grant_id,
                    "benefit_type": "custom",
                },
            )
        )

        # 6. Subscription cycles + order payments over time
        interval_days = {"day": 1, "week": 7, "month": 30, "year": 365}
        cycle_days = interval_days.get(str(interval), 30)
        cycle_time = t + timedelta(days=cycle_days)
        cycle_count = 0

        while cycle_time < now and cycle_count < 36:
            # Subscription cycled
            events.append(
                _evt(
                    SystemEventEnum.subscription_cycled,
                    cycle_time,
                    {
                        "subscription_id": fake_sub_id,
                        "product_id": str(chosen_product.id),
                        "amount": price_amount,
                        "currency": "usd",
                        "recurring_interval": str(interval),
                        "recurring_interval_count": 1,
                    },
                )
            )

            # Order paid for the cycle
            cycle_order_id = str(generate_uuid())
            events.append(
                _evt(
                    SystemEventEnum.order_paid,
                    cycle_time + timedelta(seconds=random.randint(1, 60)),
                    {
                        "order_id": cycle_order_id,
                        "product_id": str(chosen_product.id),
                        "amount": price_amount,
                        "currency": "usd",
                        "net_amount": int(price_amount * 0.95),
                        "tax_amount": int(price_amount * 0.05),
                        "subscription_id": fake_sub_id,
                        "recurring_interval": str(interval),
                        "recurring_interval_count": 1,
                    },
                )
            )

            # Benefit cycled
            events.append(
                _evt(
                    SystemEventEnum.benefit_cycled,
                    cycle_time + timedelta(seconds=random.randint(1, 60)),
                    {
                        "benefit_id": fake_benefit_id,
                        "benefit_grant_id": fake_grant_id,
                        "benefit_type": "custom",
                    },
                )
            )

            cycle_time += timedelta(days=cycle_days)
            cycle_count += 1

        # 7. Some customers get interesting lifecycle events
        roll = random.random()
        if roll < 0.15:
            # ~15% cancel then uncanceled
            cancel_time = t + timedelta(days=random.randint(10, days_ago - 5))
            if cancel_time < now:
                events.append(
                    _evt(
                        SystemEventEnum.subscription_canceled,
                        cancel_time,
                        {
                            "subscription_id": fake_sub_id,
                            "product_id": str(chosen_product.id),
                            "amount": price_amount,
                            "currency": "usd",
                            "recurring_interval": str(interval),
                            "recurring_interval_count": 1,
                            "customer_cancellation_reason": "too_expensive",
                            "canceled_at": cancel_time.isoformat(),
                            "cancel_at_period_end": True,
                        },
                    )
                )
                # Then uncanceled a few days later
                uncancel_time = cancel_time + timedelta(days=random.randint(1, 5))
                if uncancel_time < now:
                    events.append(
                        _evt(
                            SystemEventEnum.subscription_uncanceled,
                            uncancel_time,
                            {
                                "subscription_id": fake_sub_id,
                                "product_id": str(chosen_product.id),
                                "amount": price_amount,
                                "currency": "usd",
                                "recurring_interval": str(interval),
                                "recurring_interval_count": 1,
                            },
                        )
                    )
        elif roll < 0.30:
            # ~15% upgraded to a different product
            if len(recurring_products) > 1:
                other = random.choice(
                    [p for p in recurring_products if p.id != chosen_product.id]
                )
                upgrade_time = t + timedelta(
                    days=random.randint(7, min(60, days_ago - 5))
                )
                if upgrade_time < now:
                    events.append(
                        _evt(
                            SystemEventEnum.subscription_product_updated,
                            upgrade_time,
                            {
                                "subscription_id": fake_sub_id,
                                "old_product_id": str(chosen_product.id),
                                "new_product_id": str(other.id),
                            },
                        )
                    )
        elif roll < 0.40:
            # ~10% got a refund on one order
            refund_time = t + timedelta(days=random.randint(5, min(30, days_ago - 5)))
            if refund_time < now:
                events.append(
                    _evt(
                        SystemEventEnum.order_refunded,
                        refund_time,
                        {
                            "order_id": fake_order_id,
                            "refunded_amount": price_amount,
                            "currency": "usd",
                        },
                    )
                )
        elif roll < 0.50:
            # ~10% canceled for real
            cancel_time = t + timedelta(days=random.randint(15, days_ago - 2))
            if cancel_time < now:
                events.append(
                    _evt(
                        SystemEventEnum.subscription_canceled,
                        cancel_time,
                        {
                            "subscription_id": fake_sub_id,
                            "product_id": str(chosen_product.id),
                            "amount": price_amount,
                            "currency": "usd",
                            "recurring_interval": str(interval),
                            "recurring_interval_count": 1,
                            "customer_cancellation_reason": "unused",
                            "customer_cancellation_comment": "Not using it enough",
                            "canceled_at": cancel_time.isoformat(),
                            "cancel_at_period_end": False,
                        },
                    )
                )

    # 8. Some customers also make one-time purchases
    if onetime_products and random.random() < 0.4:
        otp = random.choice(onetime_products)
        otp_time = timeline_start + timedelta(
            days=random.randint(1, max(1, days_ago - 5))
        )
        if otp_time < now:
            otp_price = 4900
            for p in otp.all_prices:
                pa = getattr(p, "price_amount", None)
                if pa is not None:
                    otp_price = pa
                    break
            otp_order_id = str(generate_uuid())
            events.append(
                _evt(
                    SystemEventEnum.checkout_created,
                    otp_time,
                    {
                        "checkout_id": str(generate_uuid()),
                        "checkout_status": "succeeded",
                        "product_id": str(otp.id),
                    },
                )
            )
            events.append(
                _evt(
                    SystemEventEnum.order_paid,
                    otp_time + timedelta(minutes=random.randint(1, 5)),
                    {
                        "order_id": otp_order_id,
                        "product_id": str(otp.id),
                        "amount": otp_price,
                        "currency": "usd",
                        "net_amount": int(otp_price * 0.95),
                        "tax_amount": int(otp_price * 0.05),
                    },
                )
            )

    # 9. Customer updated (some customers update their info)
    if random.random() < 0.3:
        update_time = timeline_start + timedelta(
            days=random.randint(2, max(2, days_ago - 2))
        )
        if update_time < now:
            events.append(
                _evt(
                    SystemEventEnum.customer_updated,
                    update_time,
                    {
                        "customer_id": str(customer_id),
                        "customer_email": customer_email,
                        "customer_name": customer_name,
                        "customer_external_id": None,
                        "updated_fields": {"name": customer_name},
                    },
                )
            )

    return events


def _build_user_cost_span_events(
    organization_id: Any,
    customer_id: Any,
    days_back: int = 90,
) -> list[dict[str, Any]]:
    """Generate user-event span hierarchies with _cost and _llm metadata.

    Models two span types:
    - Support flow: support_request → sentiment_analysis, draft_generated, email_sent, support_request_completed
    - Document flow: document_upload → document_process, s3_upload
    """
    events: list[dict[str, Any]] = []
    now = datetime.now(UTC)

    llm_vendors = [
        {
            "vendor": "google",
            "model": "gemini-1.5-flash",
            "input_cost_per_m": 0.075,
            "output_cost_per_m": 0.30,
        },
        {
            "vendor": "google",
            "model": "gemini-1.5-pro",
            "input_cost_per_m": 3.50,
            "output_cost_per_m": 10.50,
        },
        {
            "vendor": "openai",
            "model": "gpt-4o-mini",
            "input_cost_per_m": 0.15,
            "output_cost_per_m": 0.60,
        },
        {
            "vendor": "openai",
            "model": "gpt-4o",
            "input_cost_per_m": 2.50,
            "output_cost_per_m": 10.00,
        },
        {
            "vendor": "anthropic",
            "model": "claude-3-5-haiku",
            "input_cost_per_m": 0.80,
            "output_cost_per_m": 4.00,
        },
    ]

    def _llm_child_event(
        name: str,
        parent_id: Any,
        timestamp: datetime,
        input_tokens: int,
        output_tokens: int,
        vendor_config: dict[str, Any],
        extra_metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        cost = (
            input_tokens / 1_000_000 * vendor_config["input_cost_per_m"]
            + output_tokens / 1_000_000 * vendor_config["output_cost_per_m"]
        )
        metadata: dict[str, Any] = {
            "_cost": {"amount": round(cost, 6), "currency": "usd"},
            "_llm": {
                "vendor": vendor_config["vendor"],
                "model": vendor_config["model"],
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": input_tokens + output_tokens,
            },
        }
        if extra_metadata:
            metadata.update(extra_metadata)
        return {
            "name": name,
            "source": "user",
            "timestamp": timestamp,
            "organization_id": organization_id,
            "customer_id": customer_id,
            "parent_id": parent_id,
            "user_metadata": metadata,
        }

    def _infra_child_event(
        name: str,
        parent_id: Any,
        timestamp: datetime,
        cost_amount: float,
        extra_metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        metadata: dict[str, Any] = {
            "_cost": {"amount": round(cost_amount, 6), "currency": "usd"},
        }
        if extra_metadata:
            metadata.update(extra_metadata)
        return {
            "name": name,
            "source": "user",
            "timestamp": timestamp,
            "organization_id": organization_id,
            "customer_id": customer_id,
            "parent_id": parent_id,
            "user_metadata": metadata,
        }

    def _no_cost_child_event(
        name: str,
        parent_id: Any,
        timestamp: datetime,
        extra_metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return {
            "name": name,
            "source": "user",
            "timestamp": timestamp,
            "organization_id": organization_id,
            "customer_id": customer_id,
            "parent_id": parent_id,
            "user_metadata": extra_metadata or {},
        }

    def _root_event(
        name: str,
        span_id: Any,
        timestamp: datetime,
        extra_metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return {
            "id": span_id,
            "external_id": str(span_id),
            "name": name,
            "source": "user",
            "timestamp": timestamp,
            "organization_id": organization_id,
            "customer_id": customer_id,
            "user_metadata": extra_metadata or {},
        }

    # Spread events across the past N days
    num_spans = random.randint(10, 40)
    for _ in range(num_spans):
        offset_seconds = random.randint(0, days_back * 86400)
        span_start = now - timedelta(seconds=offset_seconds)
        vendor = random.choice(llm_vendors)
        span_type = random.choice(["support", "document"])

        if span_type == "support":
            # Support request span:
            # support_request (root) → sentiment_analysis, draft_generated, email_sent, support_request_completed
            span_id = generate_uuid()
            events.append(
                _root_event(
                    "support_request",
                    span_id,
                    span_start,
                    {
                        "ticket_id": str(generate_uuid()),
                        "channel": random.choice(["email", "chat", "api"]),
                    },
                )
            )

            t = span_start

            # sentiment_analysis child
            t += timedelta(seconds=random.randint(1, 5))
            input_tokens = random.randint(200, 1500)
            output_tokens = random.randint(50, 300)
            events.append(
                _llm_child_event(
                    "sentiment_analysis",
                    span_id,
                    t,
                    input_tokens,
                    output_tokens,
                    vendor,
                    {
                        "sentiment": random.choice(
                            ["positive", "neutral", "negative", "frustrated"]
                        )
                    },
                )
            )

            # draft_generated child
            t += timedelta(seconds=random.randint(1, 10))
            input_tokens = random.randint(500, 3000)
            output_tokens = random.randint(200, 800)
            events.append(
                _llm_child_event(
                    "draft_generated",
                    span_id,
                    t,
                    input_tokens,
                    output_tokens,
                    vendor,
                )
            )

            # email_sent child (infra cost)
            t += timedelta(seconds=random.randint(1, 3))
            events.append(
                _infra_child_event(
                    "email_sent",
                    span_id,
                    t,
                    cost_amount=0.000075,  # $0.075 per 1000 emails
                    extra_metadata={"provider": "sendgrid"},
                )
            )

            # support_request_completed child (no cost)
            t += timedelta(seconds=random.randint(60, 3600))
            events.append(
                _no_cost_child_event(
                    "support_request_completed",
                    span_id,
                    t,
                    {"resolution": random.choice(["resolved", "escalated", "closed"])},
                )
            )

        else:
            # Document processing span:
            # document_upload (root) → document_process, s3_upload
            span_id = generate_uuid()
            doc_id = str(generate_uuid())
            events.append(
                _root_event(
                    "document_upload",
                    span_id,
                    span_start,
                    {
                        "document_id": doc_id,
                        "filename": random.choice(
                            ["report.pdf", "contract.docx", "data.csv", "spec.txt"]
                        ),
                        "size_bytes": random.randint(5_000, 5_000_000),
                    },
                )
            )

            t = span_start

            # document_process child (LLM)
            t += timedelta(seconds=random.randint(1, 10))
            input_tokens = random.randint(1000, 8000)
            output_tokens = random.randint(300, 2000)
            events.append(
                _llm_child_event(
                    "document_process",
                    span_id,
                    t,
                    input_tokens,
                    output_tokens,
                    vendor,
                    {
                        "document_id": doc_id,
                        "task": random.choice(
                            ["summarize", "extract", "classify", "translate"]
                        ),
                    },
                )
            )

            # s3_upload child (infra cost)
            t += timedelta(seconds=random.randint(1, 5))
            size_gb = random.uniform(0.001, 0.05)
            events.append(
                _infra_child_event(
                    "s3_upload",
                    span_id,
                    t,
                    cost_amount=round(size_gb * 0.023, 8),  # $0.023 per GB
                    extra_metadata={
                        "document_id": doc_id,
                        "size_gb": round(size_gb, 6),
                    },
                )
            )

    return events
