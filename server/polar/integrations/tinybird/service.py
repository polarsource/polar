import json
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from functools import partial
from typing import Any, Self
from uuid import UUID

import structlog

from polar.config import settings
from polar.logging import Logger
from polar.models import Event
from polar.models.event import EventSource

from .client import client
from .schemas import TinybirdEvent

log: Logger = structlog.get_logger()


@dataclass
class TinybirdEventTypeStats:
    name: str
    source: EventSource
    occurrences: int
    first_seen: datetime
    last_seen: datetime


DATASOURCE_EVENTS = "events_by_ingested_at"
MV_EVENT_TYPES_BY_CUSTOMER = "event_types_by_customer_id"


def _pop_system_metadata(m: dict[str, Any], is_system: bool, key: str) -> Any:
    v = m.pop(key, None) if is_system else None
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v


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


class TinybirdEventsQuery:
    """
    Query builder for Tinybird events table.

    Requires organization_id upfront to ensure row-level filtering
    is always applied (defense-in-depth pattern).
    """

    def __init__(self, organization_id: UUID) -> None:
        self._organization_id = organization_id
        self._where_clauses: list[str] = []
        self._parameters: dict[str, Any] = {"org_id": str(organization_id)}

    def filter_customer_id(self, customer_ids: Sequence[UUID]) -> Self:
        if customer_ids:
            self._where_clauses.append("customer_id IN {customer_ids: Array(UUID)}")
            self._parameters["customer_ids"] = [str(c) for c in customer_ids]
        return self

    def filter_external_customer_id(self, external_ids: Sequence[str]) -> Self:
        if external_ids:
            self._where_clauses.append(
                "external_customer_id IN {external_customer_ids: Array(String)}"
            )
            self._parameters["external_customer_ids"] = list(external_ids)
        return self

    def filter_root_events(self) -> Self:
        self._where_clauses.append("parent_id IS NULL")
        return self

    def filter_parent_id(self, parent_id: UUID) -> Self:
        self._where_clauses.append("parent_id = {parent_id: UUID}")
        self._parameters["parent_id"] = str(parent_id)
        return self

    def filter_source(self, source: EventSource) -> Self:
        self._where_clauses.append("source = {source: String}")
        self._parameters["source"] = source.value
        return self

    def _build_where_clause(self) -> str:
        base_clause = "organization_id = {org_id: UUID}"
        if self._where_clauses:
            return f"{base_clause} AND " + " AND ".join(self._where_clauses)
        return base_clause

    async def get_event_type_stats(self) -> list[TinybirdEventTypeStats]:
        where_clause = self._build_where_clause()

        sql = f"""
            SELECT
                name,
                source,
                count() as occurrences,
                min(timestamp) as first_seen,
                max(timestamp) as last_seen
            FROM {DATASOURCE_EVENTS}
            WHERE {where_clause}
            GROUP BY name, source
        """

        try:
            rows = await client.query(sql, parameters=self._parameters)
            return [
                TinybirdEventTypeStats(
                    name=row["name"],
                    source=EventSource(row["source"]),
                    occurrences=row["occurrences"],
                    first_seen=row["first_seen"],
                    last_seen=row["last_seen"],
                )
                for row in rows
            ]
        except Exception as e:
            log.error("tinybird.get_event_type_stats.failed", error=str(e))
            raise

    async def get_event_type_stats_from_mv(self) -> list[TinybirdEventTypeStats]:
        """
        Query event type stats from the materialized view.

        Note: MV is pre-aggregated so may be faster for large datasets,
        but requires customer_id filter to be effective.
        """
        where_clause = self._build_where_clause()

        sql = f"""
            SELECT
                name,
                source,
                countMerge(occurrences) as occurrences,
                minMerge(first_seen) as first_seen,
                maxMerge(last_seen) as last_seen
            FROM {MV_EVENT_TYPES_BY_CUSTOMER}
            WHERE {where_clause}
            GROUP BY name, source
        """

        try:
            rows = await client.query(sql, parameters=self._parameters)
            return [
                TinybirdEventTypeStats(
                    name=row["name"],
                    source=EventSource(row["source"]),
                    occurrences=row["occurrences"],
                    first_seen=row["first_seen"],
                    last_seen=row["last_seen"],
                )
                for row in rows
            ]
        except Exception as e:
            log.error("tinybird.get_event_type_stats_from_mv.failed", error=str(e))
            raise
