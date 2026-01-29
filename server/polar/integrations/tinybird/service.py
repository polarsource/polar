import json
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from functools import partial
from typing import Any, Self
from uuid import UUID

import structlog
from clickhouse_connect.cc_sqlalchemy.dialect import ClickHouseDialect
from sqlalchemy import Column, DateTime, MetaData, String, Table, func, select
from sqlalchemy.sql import Select

from polar.config import settings
from polar.logging import Logger
from polar.models import Event
from polar.models.event import EventSource

from .client import client
from .schemas import TinybirdEvent

log: Logger = structlog.get_logger()

clickhouse_dialect = ClickHouseDialect()
metadata = MetaData()

events_table = Table(
    "events_by_ingested_at",
    metadata,
    Column("name", String),
    Column("source", String),
    Column("organization_id", String),
    Column("customer_id", String),
    Column("external_customer_id", String),
    Column("parent_id", String),
    Column("timestamp", DateTime),
)

event_types_mv = Table(
    "event_types_by_customer_id",
    metadata,
    Column("name", String),
    Column("source", String),
    Column("organization_id", String),
    Column("customer_id", String),
    Column("external_customer_id", String),
    Column("parent_id", String),
    Column("occurrences", String),
    Column("first_seen", DateTime),
    Column("last_seen", DateTime),
)


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
    Query builder for Tinybird events table using SQLAlchemy.

    Requires organization_id upfront to ensure row-level filtering
    is always applied (defense-in-depth pattern).
    """

    def __init__(self, organization_id: UUID) -> None:
        self._organization_id = str(organization_id)
        self._filters: list[Any] = []
        self._order_by_clauses: list[Any] = []

    def filter_customer_id(self, customer_ids: Sequence[UUID]) -> Self:
        if customer_ids:
            self._filters.append(
                events_table.c.customer_id.in_([str(c) for c in customer_ids])
            )
        return self

    def filter_external_customer_id(self, external_ids: Sequence[str]) -> Self:
        if external_ids:
            self._filters.append(
                events_table.c.external_customer_id.in_(list(external_ids))
            )
        return self

    def filter_root_events(self) -> Self:
        self._filters.append(events_table.c.parent_id.is_(None))
        return self

    def filter_parent_id(self, parent_id: UUID) -> Self:
        self._filters.append(events_table.c.parent_id == str(parent_id))
        return self

    def filter_source(self, source: EventSource) -> Self:
        self._filters.append(events_table.c.source == source.value)
        return self

    _SORT_COLUMN_MAP = {
        "name": events_table.c.name,
        "first_seen": func.min(events_table.c.timestamp),
        "last_seen": func.max(events_table.c.timestamp),
        "occurrences": func.count(),
    }

    def order_by(self, column: str, descending: bool = False) -> Self:
        col = self._SORT_COLUMN_MAP.get(column)
        if col is None:
            raise ValueError(f"Invalid sort column: {column}")
        self._order_by_clauses.append(col.desc() if descending else col.asc())
        return self

    def _build_base_statement(self) -> Select[Any]:
        statement = (
            select(
                events_table.c.name,
                events_table.c.source,
                func.count().label("occurrences"),
                func.min(events_table.c.timestamp).label("first_seen"),
                func.max(events_table.c.timestamp).label("last_seen"),
            )
            .where(events_table.c.organization_id == self._organization_id)
            .group_by(events_table.c.name, events_table.c.source)
        )

        for f in self._filters:
            statement = statement.where(f)

        if self._order_by_clauses:
            statement = statement.order_by(*self._order_by_clauses)
        else:
            statement = statement.order_by(func.max(events_table.c.timestamp).desc())

        return statement

    def _compile(self, statement: Select[Any]) -> str:
        return str(
            statement.compile(
                dialect=clickhouse_dialect, compile_kwargs={"literal_binds": True}
            )
        )

    async def get_event_type_stats(self) -> list[TinybirdEventTypeStats]:
        statement = self._build_base_statement()
        sql = self._compile(statement)

        try:
            rows = await client.query(sql)
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
        statement = (
            select(
                event_types_mv.c.name,
                event_types_mv.c.source,
                func.countMerge(event_types_mv.c.occurrences).label("occurrences"),
                func.minMerge(event_types_mv.c.first_seen).label("first_seen"),
                func.maxMerge(event_types_mv.c.last_seen).label("last_seen"),
            )
            .where(event_types_mv.c.organization_id == self._organization_id)
            .group_by(event_types_mv.c.name, event_types_mv.c.source)
        )

        for f in self._filters:
            statement = statement.where(f)

        if self._order_by_clauses:
            statement = statement.order_by(*self._order_by_clauses)
        else:
            statement = statement.order_by(
                func.maxMerge(event_types_mv.c.last_seen).desc()
            )

        sql = self._compile(statement)

        try:
            rows = await client.query(sql)
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
