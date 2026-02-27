import json
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from functools import partial
from typing import Any, Self
from uuid import UUID

import logfire
import structlog
from clickhouse_connect.cc_sqlalchemy.dialect import ClickHouseDialect
from sqlalchemy import (
    Column,
    DateTime,
    Float,
    MetaData,
    String,
    Table,
    and_,
    false,
    func,
    or_,
    select,
    true,
)
from sqlalchemy.sql import Select

from polar.config import settings
from polar.event.repository import EventRepository
from polar.kit.db.postgres import AsyncReadSession
from polar.logging import Logger
from polar.meter.filter import Filter, FilterClause, FilterConjunction, FilterOperator
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
    Column("id", String),
    Column("name", String),
    Column("source", String),
    Column("organization_id", String),
    Column("customer_id", String),
    Column("external_customer_id", String),
    Column("parent_id", String),
    Column("root_id", String),
    Column("event_type_id", String),
    Column("timestamp", DateTime),
    Column("cost_amount", Float),
    Column("cost_currency", String),
    Column("llm_vendor", String),
    Column("llm_model", String),
    Column("llm_input_tokens", Float),
    Column("llm_output_tokens", Float),
    Column("user_metadata", String),
)

DENORMALIZED_COLUMNS: dict[str, Any] = {
    "_cost.amount": events_table.c.cost_amount,
    "_cost.currency": events_table.c.cost_currency,
    "_llm.vendor": events_table.c.llm_vendor,
    "_llm.model": events_table.c.llm_model,
    "_llm.input_tokens": events_table.c.llm_input_tokens,
    "_llm.output_tokens": events_table.c.llm_output_tokens,
}


@dataclass
class TinybirdEventTypeStats:
    name: str
    source: EventSource
    occurrences: int
    first_seen: datetime
    last_seen: datetime


DATASOURCE_EVENTS = "events_by_ingested_at"


def _pop_system_metadata(m: dict[str, Any], is_system: bool, key: str) -> Any:
    v = m.pop(key, None) if is_system else None
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v


def _truncate_datetime_to_millis(dt_str: str | None) -> str | None:
    if dt_str is None:
        return None
    try:
        dt = datetime.fromisoformat(dt_str)
        return dt.isoformat(timespec="milliseconds")
    except (ValueError, TypeError):
        return dt_str


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
        member_id=str(event.member_id) if event.member_id else None,
        external_member_id=event.external_member_id,
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
        order_created_at=_truncate_datetime_to_millis(pop("order_created_at")),
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
        exchange_rate=pop("exchange_rate"),
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


RECONCILE_BATCH_SIZE = 1000


async def reconcile_events(
    session: AsyncReadSession,
    start: datetime,
    end: datetime,
    *,
    dry_run: bool = False,
) -> tuple[int, int, list[str]]:
    tb_sql = (
        "SELECT DISTINCT toString(id) AS id "
        "FROM events_by_ingested_at "
        "WHERE ingested_at >= {start:DateTime64(3)} "
        "AND ingested_at < {end:DateTime64(3)}"
    )
    tb_rows = await client.query(
        tb_sql,
        parameters={"start": start, "end": end},
        db_statement="SELECT DISTINCT toString(id) FROM events_by_ingested_at WHERE ingested_at >= {start} AND ingested_at < {end}",
    )
    tb_ids = {row["id"] for row in tb_rows}

    repository = EventRepository.from_session(session)
    base_statement = (
        repository.get_base_statement()
        .where(Event.ingested_at >= start, Event.ingested_at < end)
        .order_by(Event.ingested_at, Event.id)
    )

    total_checked = 0
    total_missing = 0
    missing_ids: list[str] = []
    offset = 0

    while True:
        statement = base_statement.offset(offset).limit(RECONCILE_BATCH_SIZE)
        batch = await repository.get_all(statement)

        if not batch:
            break

        total_checked += len(batch)
        missing = [e for e in batch if str(e.id) not in tb_ids]
        total_missing += len(missing)

        if missing:
            missing_ids.extend(str(e.id) for e in missing)
            if not dry_run:
                await ingest_events(missing)

        if len(batch) < RECONCILE_BATCH_SIZE:
            break

        offset += RECONCILE_BATCH_SIZE

    logfire.info(
        "tinybird.reconciliation",
        missing_count=total_missing,
        total_checked=total_checked,
        start=start.isoformat(),
        end=end.isoformat(),
        dry_run=dry_run,
    )

    return total_checked, total_missing, missing_ids


def _compile(statement: Select[Any]) -> tuple[str, str]:
    compiled = statement.compile(dialect=clickhouse_dialect)
    template = str(compiled)
    literal = str(
        statement.compile(
            dialect=clickhouse_dialect, compile_kwargs={"literal_binds": True}
        )
    )
    return literal, template


def _parse_datetime(value: datetime | str) -> datetime:
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _parse_event_type_stats(rows: list[dict[str, Any]]) -> list[TinybirdEventTypeStats]:
    return [
        TinybirdEventTypeStats(
            name=row["name"],
            source=EventSource(row["source"]),
            occurrences=row["occurrences"],
            first_seen=_parse_datetime(row["first_seen"]),
            last_seen=_parse_datetime(row["last_seen"]),
        )
        for row in rows
    ]


class TinybirdEventsQuery:
    """
    Query builder for the raw events table.

    Supports all filters including customer_id, external_customer_id,
    parent_id, root_events, and source.
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

    def filter_sources(self, sources: Sequence[EventSource]) -> Self:
        if sources:
            self._filters.append(events_table.c.source.in_([s.value for s in sources]))
        return self

    def filter_name_query(self, query: str) -> Self:
        self._filters.append(events_table.c.name.ilike(f"%{query}%"))
        return self

    def filter_timestamp_range(
        self, start: datetime | None = None, end: datetime | None = None
    ) -> Self:
        if start is not None:
            self._filters.append(events_table.c.timestamp > start)
        if end is not None:
            self._filters.append(events_table.c.timestamp < end)
        return self

    def filter_names(self, names: Sequence[str]) -> Self:
        if names:
            self._filters.append(events_table.c.name.in_(list(names)))
        return self

    def filter_event_type_id(self, event_type_id: UUID) -> Self:
        self._filters.append(events_table.c.event_type_id == str(event_type_id))
        return self

    def filter_by_filter(self, f: Filter) -> Self:
        self._filters.append(self._translate_filter(f))
        return self

    def filter_by_metadata(self, query: dict[str, list[str]]) -> Self:
        for key, values in query.items():
            col = DENORMALIZED_COLUMNS.get(key)
            attr = (
                col
                if col is not None
                else func.JSONExtractString(events_table.c.user_metadata, key)
            )
            self._filters.append(or_(*[attr == v for v in values]))
        return self

    def filter_by_query(
        self,
        query: str,
        matching_customer_ids: Sequence[UUID] | None = None,
        matching_external_customer_ids: Sequence[str] | None = None,
    ) -> Self:
        conditions: list[Any] = [
            events_table.c.name.ilike(f"%{query}%"),
            events_table.c.source.ilike(f"%{query}%"),
            events_table.c.user_metadata.ilike(f"%{query}%"),
        ]
        if matching_customer_ids:
            conditions.append(
                events_table.c.customer_id.in_([str(c) for c in matching_customer_ids])
            )
        if matching_external_customer_ids:
            conditions.append(
                events_table.c.external_customer_id.in_(
                    list(matching_external_customer_ids)
                )
            )
        self._filters.append(or_(*conditions))
        return self

    def filter_customer_id_with_cross_ref(
        self, customer_ids: Sequence[UUID], cross_external_ids: Sequence[str]
    ) -> Self:
        conditions: list[Any] = [
            events_table.c.customer_id.in_([str(c) for c in customer_ids])
        ]
        if cross_external_ids:
            conditions.append(
                events_table.c.external_customer_id.in_(list(cross_external_ids))
            )
        self._filters.append(or_(*conditions))
        return self

    def filter_external_customer_id_with_cross_ref(
        self, external_ids: Sequence[str], cross_customer_ids: Sequence[UUID]
    ) -> Self:
        conditions: list[Any] = [
            events_table.c.external_customer_id.in_(list(external_ids))
        ]
        if cross_customer_ids:
            conditions.append(
                events_table.c.customer_id.in_([str(c) for c in cross_customer_ids])
            )
        self._filters.append(or_(*conditions))
        return self

    def filter_numeric_metadata_property(self, property: str) -> Self:
        col = DENORMALIZED_COLUMNS.get(property)
        if col is not None:
            self._filters.append(col.isnot(None))
            return self
        parts = property.split(".")
        raw = func.JSONExtractRaw(events_table.c.user_metadata, *parts)
        self._filters.append(func.toFloat64OrNull(raw).isnot(None))
        return self

    def _translate_filter(self, f: Filter) -> Any:
        clauses = [
            self._translate_filter_clause(c)
            if isinstance(c, FilterClause)
            else self._translate_filter(c)
            for c in f.clauses
        ]
        conjunction = and_ if f.conjunction == FilterConjunction.and_ else or_
        return conjunction(*clauses or (true(),))

    def _translate_filter_clause(self, clause: FilterClause) -> Any:
        if clause.property == "name":
            if not isinstance(clause.value, str):
                return false()
            return self._ch_comparison(events_table.c.name, clause)
        if clause.property == "source":
            if not isinstance(clause.value, str):
                return false()
            return self._ch_comparison(events_table.c.source, clause)
        if clause.property == "timestamp":
            if not isinstance(clause.value, int):
                return false()
            return self._ch_comparison(
                func.toUnixTimestamp(events_table.c.timestamp), clause
            )

        col = DENORMALIZED_COLUMNS.get(clause.property)
        if col is not None:
            return self._ch_comparison(col, clause)

        parts = clause.property.split(".")
        if clause.operator in (FilterOperator.like, FilterOperator.not_like):
            attr = func.JSONExtractString(events_table.c.user_metadata, *parts)
        elif isinstance(clause.value, str):
            attr = func.JSONExtractString(events_table.c.user_metadata, *parts)
        else:
            attr = func.JSONExtractFloat(events_table.c.user_metadata, *parts)
        return self._ch_comparison(attr, clause)

    @staticmethod
    def _ch_comparison(attr: Any, clause: FilterClause) -> Any:
        v = clause.value
        if clause.operator in (FilterOperator.like, FilterOperator.not_like):
            v = str(v) if not isinstance(v, bool) else ("t" if v else "f")
        op = clause.operator
        if op == FilterOperator.eq:
            return attr == v
        if op == FilterOperator.ne:
            return attr != v
        if op == FilterOperator.gt:
            return attr > v
        if op == FilterOperator.gte:
            return attr >= v
        if op == FilterOperator.lt:
            return attr < v
        if op == FilterOperator.lte:
            return attr <= v
        if op == FilterOperator.like:
            return attr.like(f"%{v}%")
        if op == FilterOperator.not_like:
            return attr.notlike(f"%{v}%")
        return false()

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

    async def get_event_type_stats(self) -> list[TinybirdEventTypeStats]:
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

        sql, template = _compile(statement)

        try:
            rows = await client.query(sql, db_statement=template)
            return _parse_event_type_stats(rows)
        except Exception as e:
            log.error("tinybird.get_event_type_stats.failed", error=str(e))
            raise

    async def get_event_ids_and_count(
        self, limit: int, offset: int, descending: bool = True
    ) -> tuple[list[str], int]:
        base_filter = events_table.c.organization_id == self._organization_id

        count_statement = (
            select(func.count().label("total"))
            .select_from(events_table)
            .where(base_filter)
        )
        for f in self._filters:
            count_statement = count_statement.where(f)

        order = (
            events_table.c.timestamp.desc()
            if descending
            else events_table.c.timestamp.asc()
        )
        ids_statement = (
            select(events_table.c.id)
            .where(base_filter)
            .order_by(order)
            .limit(limit)
            .offset(offset)
        )
        for f in self._filters:
            ids_statement = ids_statement.where(f)

        count_sql, count_template = _compile(count_statement)
        ids_sql, ids_template = _compile(ids_statement)

        count_rows = await client.query(count_sql, db_statement=count_template)
        total = count_rows[0]["total"] if count_rows else 0

        id_rows = await client.query(ids_sql, db_statement=ids_template)
        event_ids = [row["id"] for row in id_rows]

        return event_ids, total


class TinybirdEventTypesQuery:
    """
    Query builder for the event_types materialized view via Tinybird endpoint.

    Supports source filter only. For customer/parent filtering,
    use TinybirdEventsQuery against the raw table.
    """

    _VALID_SORT_COLUMNS = {"name", "first_seen", "last_seen", "occurrences"}

    def __init__(self, organization_id: UUID) -> None:
        self._organization_id = str(organization_id)
        self._source: str | None = None
        self._order_by: str | None = None
        self._order_direction: str | None = None

    def filter_source(self, source: EventSource) -> Self:
        self._source = source.value
        return self

    def order_by(self, column: str, descending: bool = False) -> Self:
        if column not in self._VALID_SORT_COLUMNS:
            raise ValueError(f"Invalid sort column: {column}")
        self._order_by = column
        self._order_direction = "desc" if descending else "asc"
        return self

    async def get_event_type_stats(self) -> list[TinybirdEventTypeStats]:
        params: dict[str, Any] = {"organization_id": self._organization_id}
        if self._source is not None:
            params["source"] = self._source
        if self._order_by is not None:
            params["order_by"] = self._order_by
        if self._order_direction is not None:
            params["order_direction"] = self._order_direction

        try:
            rows = await client.endpoint("event_types_endpoint", params)
            return _parse_event_type_stats(rows)
        except Exception as e:
            log.error("tinybird.get_event_type_stats_from_mv.failed", error=str(e))
            raise


DENORMALIZED_AGG_FIELDS = {
    "_cost.amount",
    "_cost.currency",
    "_llm.input_tokens",
    "_llm.output_tokens",
}


@dataclass
class TinybirdTimeseriesBucket:
    name: str
    bucket: datetime
    occurrences: int
    customers: int
    field_sum: float
    field_avg: float
    field_p10: float
    field_p90: float
    field_p99: float


def _build_agg_field_params(field_path: str) -> dict[str, str]:
    if field_path in DENORMALIZED_AGG_FIELDS:
        return {"agg_field": field_path}
    parts = field_path.split(".")
    params: dict[str, str] = {"agg_depth": str(len(parts))}
    for i, part in enumerate(parts, 1):
        params[f"agg_key_{i}"] = part
    return params


async def get_timeseries_occurrences(
    organization_id: UUID,
    start_timestamp: datetime,
    end_timestamp: datetime,
    interval: str,
    timezone: str,
    *,
    aggregate_field: str = "_cost.amount",
    customer_id: Sequence[UUID] | None = None,
    external_customer_id: Sequence[str] | None = None,
    name: Sequence[str] | None = None,
    event_type_id: UUID | None = None,
) -> list[TinybirdTimeseriesBucket]:
    params: dict[str, Any] = {
        "organization_id": str(organization_id),
        "start_dt": start_timestamp.strftime("%Y-%m-%d %H:%M:%S"),
        "end_dt": end_timestamp.strftime("%Y-%m-%d %H:%M:%S"),
        "interval": interval,
        "tz": timezone,
        **_build_agg_field_params(aggregate_field),
    }

    if customer_id:
        params["customer_ids"] = ",".join(str(c) for c in customer_id)
    if external_customer_id:
        params["external_customer_ids"] = ",".join(external_customer_id)
    if name:
        params["names"] = ",".join(name)
    if event_type_id:
        params["event_type_id"] = str(event_type_id)

    rows = await client.endpoint("event_timeseries_endpoint", params)

    return [
        TinybirdTimeseriesBucket(
            name=row["name"],
            bucket=_parse_datetime(row["bucket"]),
            occurrences=row["occurrences"],
            customers=row["customers"],
            field_sum=float(row.get("field_sum", 0) or 0),
            field_avg=float(row.get("field_avg", 0) or 0),
            field_p10=float(row.get("field_p10", 0) or 0),
            field_p90=float(row.get("field_p90", 0) or 0),
            field_p99=float(row.get("field_p99", 0) or 0),
        )
        for row in rows
    ]
