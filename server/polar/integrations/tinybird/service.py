import json
import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime
from functools import partial
from typing import Any, Self
from uuid import UUID

import logfire
import sqlalchemy
import structlog
from clickhouse_connect.cc_sqlalchemy.dialect import ClickHouseDialect
from sqlalchemy import (
    Column,
    ColumnClause,
    DateTime,
    Float,
    MetaData,
    String,
    Table,
    and_,
    false,
    func,
    literal_column,
    or_,
    select,
    true,
)
from sqlalchemy.sql import Select
from sqlalchemy.sql.util import ClauseAdapter

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
    "events_by_timestamp",
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
    Column("ancestors", String),
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
    organization_id: UUID
    name: str
    source: EventSource
    occurrences: int
    first_seen: datetime
    last_seen: datetime


DATASOURCE_EVENTS = "events_by_ingested_at"


@dataclass
class TinybirdTimeseriesStats:
    organization_id: str
    name: str
    bucket: datetime
    occurrences: int
    customers: int
    totals: dict[str, float]
    averages: dict[str, float]
    p10: dict[str, float]
    p90: dict[str, float]
    p99: dict[str, float]


@dataclass
class TinybirdPropertyGroupStats:
    value: str
    occurrences: int
    customers: int
    totals: dict[str, float]


@dataclass
class TinybirdCustomerStat:
    customer_id: str | None
    external_customer_id: str | None
    occurrences: int
    totals: dict[str, float]
    share: float = 0.0


@dataclass
class TinybirdVarianceStat:
    event_id: str
    name: str
    customer_id: str | None
    external_customer_id: str | None
    timestamp: datetime
    values: dict[str, float]
    averages: dict[str, float]
    p99: dict[str, float]


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


def _event_to_tinybird(
    event: Event, ancestors: Sequence[str] | None = None
) -> TinybirdEvent:
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
        trial_end=pop("trial_end"),
        seats=pop("seats"),
        billing_period_end=pop("billing_period_end"),
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
        ancestors=list(ancestors) if ancestors else [],
    )


def events_to_tinybird(
    events: Sequence[Event],
    ancestors_by_event: Mapping[UUID, Sequence[str]] | None = None,
) -> list[TinybirdEvent]:
    return [_event_to_tinybird(e, (ancestors_by_event or {}).get(e.id)) for e in events]


async def ingest_events(
    events: Sequence[Event],
    ancestors_by_event: Mapping[UUID, Sequence[str]] | None = None,
) -> None:
    if not events:
        return

    tinybird_events = events_to_tinybird(events, ancestors_by_event)
    await client.ingest(DATASOURCE_EVENTS, tinybird_events)


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


def _finite(value: Any, default: float = 0.0) -> float:
    """Convert a value to float, returning default for NaN/Infinity."""
    try:
        result = float(value or 0)
    except (TypeError, ValueError):
        return default
    return result if math.isfinite(result) else default


def _compile(statement: Select[Any]) -> tuple[str, str]:
    compiled = statement.compile(dialect=clickhouse_dialect)
    template = str(compiled)
    literal = str(
        statement.compile(
            dialect=clickhouse_dialect, compile_kwargs={"literal_binds": True}
        )
    )
    return literal, template


def _parse_datetime(value: datetime | date | str) -> datetime:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day, tzinfo=UTC)
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _parse_uuid(value: UUID | str) -> UUID:
    return value if isinstance(value, UUID) else UUID(value)


def _parse_event_type_stats(
    rows: list[dict[str, Any]], organization_id: UUID | None = None
) -> list[TinybirdEventTypeStats]:
    return [
        TinybirdEventTypeStats(
            organization_id=_parse_uuid(row["organization_id"])
            if "organization_id" in row
            else organization_id,  # type: ignore[arg-type]
            name=row["name"],
            source=EventSource(row["source"]),
            occurrences=row["occurrences"],
            first_seen=_parse_datetime(row["first_seen"]),
            last_seen=_parse_datetime(row["last_seen"]),
        )
        for row in rows
    ]


def _adapt_filter_to_alias(clause: Any, alias: Any) -> Any:
    return ClauseAdapter(alias).traverse(clause)


class TinybirdEventsQuery:
    """
    Query builder for the raw events table.

    Supports all filters including customer_id, external_customer_id,
    parent_id, root_events, and source.
    """

    def __init__(self, organization_ids: Sequence[UUID]) -> None:
        self._organization_ids = [str(org_id) for org_id in organization_ids]
        self._filters: list[Any] = []
        self._order_by_clauses: list[Any] = []

    def _get_organization_filter(self) -> Any:
        if not self._organization_ids:
            return false()
        return events_table.c.organization_id.in_(self._organization_ids)

    def filter_event_id(self, event_id: UUID) -> Self:
        self._filters.append(events_table.c.id == str(event_id))
        return self

    def filter_has_ancestor(self, ancestor_id: UUID) -> Self:
        self._filters.append(
            func.indexOf(events_table.c.ancestors, str(ancestor_id)) > 0
        )
        return self

    def filter_self_or_descendant(self, event_id: UUID) -> Self:
        """Match the event itself OR any event that has event_id as an ancestor."""
        eid = str(event_id)
        self._filters.append(
            or_(
                events_table.c.id == eid,
                func.indexOf(events_table.c.ancestors, eid) > 0,
            )
        )
        return self

    def filter_root_events(self) -> Self:
        self._filters.append(events_table.c.parent_id.is_(None))
        return self

    def filter_parent_id(self, parent_id: UUID) -> Self:
        self._filters.append(events_table.c.parent_id == str(parent_id))
        return self

    def filter_by_depth(self, depth: int, parent_id: UUID | None = None) -> Self:
        ancestors = events_table.c.ancestors
        if parent_id is not None:
            pid = str(parent_id)
            self._filters.append(func.indexOf(ancestors, pid) > 0)
            self._filters.append(func.indexOf(ancestors, pid) <= depth)
        else:
            if depth == 0:
                self.filter_root_events()
                return self
            self._filters.append(func.length(ancestors) <= depth)
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
            self._filters.append(
                events_table.c.timestamp > start.astimezone(UTC).replace(tzinfo=None)
            )
        if end is not None:
            self._filters.append(
                events_table.c.timestamp < end.astimezone(UTC).replace(tzinfo=None)
            )
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

    def filter_customer(
        self,
        customer_ids: Sequence[UUID] = (),
        external_customer_ids: Sequence[str] = (),
    ) -> Self:
        conditions: list[Any] = []
        if customer_ids:
            conditions.append(
                events_table.c.customer_id.in_([str(c) for c in customer_ids])
            )
        if external_customer_ids:
            conditions.append(
                events_table.c.external_customer_id.in_(list(external_customer_ids))
            )
        if conditions:
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
        base_filter = self._get_organization_filter()
        statement = (
            select(
                events_table.c.organization_id,
                events_table.c.name,
                events_table.c.source,
                func.count().label("occurrences"),
                func.min(events_table.c.timestamp).label("first_seen"),
                func.max(events_table.c.timestamp).label("last_seen"),
            )
            .where(base_filter)
            .group_by(
                events_table.c.organization_id,
                events_table.c.name,
                events_table.c.source,
            )
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
        base_filter = self._get_organization_filter()

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
        event_ids = [str(row["id"]) for row in id_rows]

        return event_ids, total

    @staticmethod
    def _get_agg_col_for_table(table: Any, field_path: str) -> Any:
        col_name = DENORMALIZED_COLUMNS.get(field_path)
        if col_name is not None:
            return table.c[col_name.name]
        parts = field_path.split(".")
        return func.JSONExtractFloat(table.c.user_metadata, *parts)

    def _build_per_root_subquery(self, aggregate_fields: Sequence[str]) -> Any:
        base_filter = self._get_organization_filter()
        re = events_table.alias("re")
        ae = events_table.alias("ae")

        agg_columns = []
        for field_path in aggregate_fields:
            label = field_path.replace(".", "_")
            ae_col = self._get_agg_col_for_table(ae, field_path)
            agg_columns.append(
                func.coalesce(func.sum(ae_col), 0).label(f"{label}_total")
            )

        org_filter_values = self._organization_ids
        ae_org_filter = (
            ae.c.organization_id.in_(org_filter_values)
            if len(org_filter_values) > 1
            else ae.c.organization_id == org_filter_values[0]
        )

        statement = (
            sqlalchemy.select(
                re.c.id.label("root_id"),
                re.c.organization_id.label("organization_id"),
                re.c.name.label("root_name"),
                re.c.timestamp.label("root_timestamp"),
                re.c.customer_id.label("customer_id"),
                re.c.external_customer_id.label("external_customer_id"),
                *agg_columns,
            )
            .select_from(
                re.join(
                    ae,
                    and_(ae.c.root_id == re.c.id, ae_org_filter),
                    isouter=True,
                )
            )
            .where(
                re.c.organization_id.in_(org_filter_values),
                re.c.parent_id.is_(None),
                re.c.source == EventSource.user.value,
            )
            .group_by(
                re.c.id,
                re.c.organization_id,
                re.c.name,
                re.c.timestamp,
                re.c.customer_id,
                re.c.external_customer_id,
            )
        )

        for f in self._filters:
            adapted = _adapt_filter_to_alias(f, re)
            statement = statement.where(adapted)

        return statement.subquery("per_root")

    @staticmethod
    def _build_outer_agg_columns(
        subquery: Any, aggregate_fields: Sequence[str]
    ) -> list[Any]:
        columns: list[Any] = []
        for field_path in aggregate_fields:
            label = field_path.replace(".", "_")
            total_col = subquery.c[f"{label}_total"]
            total_col_sql = f"per_root.{label}_total"
            columns.extend(
                [
                    func.sum(total_col).label(f"{label}_sum"),
                    func.avg(total_col).label(f"{label}_avg"),
                    literal_column(f"quantile(0.10)({total_col_sql})").label(
                        f"{label}_p10"
                    ),
                    literal_column(f"quantile(0.90)({total_col_sql})").label(
                        f"{label}_p90"
                    ),
                    literal_column(f"quantile(0.99)({total_col_sql})").label(
                        f"{label}_p99"
                    ),
                ]
            )
        return columns

    @staticmethod
    def _parse_agg_row(
        row: dict[str, Any], aggregate_fields: Sequence[str]
    ) -> tuple[
        dict[str, float],
        dict[str, float],
        dict[str, float],
        dict[str, float],
        dict[str, float],
    ]:
        totals: dict[str, float] = {}
        averages: dict[str, float] = {}
        p10: dict[str, float] = {}
        p90: dict[str, float] = {}
        p99: dict[str, float] = {}
        for field_path in aggregate_fields:
            label = field_path.replace(".", "_")
            totals[label] = float(row.get(f"{label}_sum", 0) or 0)
            averages[label] = float(row.get(f"{label}_avg", 0) or 0)
            p10[label] = float(row.get(f"{label}_p10", 0) or 0)
            p90[label] = float(row.get(f"{label}_p90", 0) or 0)
            p99[label] = float(row.get(f"{label}_p99", 0) or 0)
        return totals, averages, p10, p90, p99

    async def get_timeseries_stats(
        self,
        interval: str,
        timezone: str,
        aggregate_fields: Sequence[str],
    ) -> list[TinybirdTimeseriesStats]:
        per_root = self._build_per_root_subquery(aggregate_fields)

        bucket = func.date_trunc(
            interval, per_root.c.root_timestamp, sqlalchemy.literal(timezone, String)
        ).label("bucket")

        statement = (
            sqlalchemy.select(
                per_root.c.organization_id.label("organization_id"),
                per_root.c.root_name.label("name"),
                bucket,
                func.count().label("occurrences"),
                literal_column(
                    "uniqExact(if(per_root.customer_id IS NOT NULL,"
                    " toString(per_root.customer_id),"
                    " per_root.external_customer_id))"
                ).label("customers"),
                *self._build_outer_agg_columns(per_root, aggregate_fields),
            )
            .select_from(per_root)
            .group_by(per_root.c.organization_id, per_root.c.root_name, bucket)
            .order_by(bucket, per_root.c.organization_id, per_root.c.root_name)
        )

        sql, template = _compile(statement)
        rows = await client.query(sql, db_statement=template)

        results = []
        for row in rows:
            totals, averages, p10, p90, p99 = self._parse_agg_row(row, aggregate_fields)
            results.append(
                TinybirdTimeseriesStats(
                    organization_id=row["organization_id"],
                    name=row["name"],
                    bucket=_parse_datetime(row["bucket"]),
                    occurrences=row["occurrences"],
                    customers=row["customers"],
                    totals=totals,
                    averages=averages,
                    p10=p10,
                    p90=p90,
                    p99=p99,
                )
            )
        return results

    async def get_totals_stats(
        self,
        aggregate_fields: Sequence[str],
    ) -> list[TinybirdTimeseriesStats]:
        per_root = self._build_per_root_subquery(aggregate_fields)

        statement = (
            sqlalchemy.select(
                per_root.c.organization_id.label("organization_id"),
                per_root.c.root_name.label("name"),
                func.count().label("occurrences"),
                literal_column(
                    "uniqExact(if(per_root.customer_id IS NOT NULL,"
                    " toString(per_root.customer_id),"
                    " per_root.external_customer_id))"
                ).label("customers"),
                *self._build_outer_agg_columns(per_root, aggregate_fields),
            )
            .select_from(per_root)
            .group_by(per_root.c.organization_id, per_root.c.root_name)
        )

        sql, template = _compile(statement)
        rows = await client.query(sql, db_statement=template)

        results = []
        for row in rows:
            totals, averages, p10, p90, p99 = self._parse_agg_row(row, aggregate_fields)
            results.append(
                TinybirdTimeseriesStats(
                    organization_id=row["organization_id"],
                    name=row["name"],
                    bucket=datetime.min,
                    occurrences=row["occurrences"],
                    customers=row["customers"],
                    totals=totals,
                    averages=averages,
                    p10=p10,
                    p90=p90,
                    p99=p99,
                )
            )
        return results

    async def get_descendant_aggregates(
        self, aggregate_fields: Sequence[str]
    ) -> tuple[int, dict[str, float]]:
        base_filter = self._get_organization_filter()

        columns: list[Any] = [func.count().label("total")]
        for field_path in aggregate_fields:
            label = field_path.replace(".", "_")
            col = DENORMALIZED_COLUMNS.get(field_path)
            if col is not None:
                columns.append(func.sum(col).label(label))
            else:
                parts = field_path.split(".")
                columns.append(
                    func.sum(
                        func.JSONExtractFloat(events_table.c.user_metadata, *parts)
                    ).label(label)
                )

        statement = (
            sqlalchemy.select(*columns).select_from(events_table).where(base_filter)
        )
        for f in self._filters:
            statement = statement.where(f)

        sql, template = _compile(statement)
        rows = await client.query(sql, db_statement=template)

        if not rows:
            return 0, {f.replace(".", "_"): 0.0 for f in aggregate_fields}

        row = rows[0]
        sums = {
            f.replace(".", "_"): float(row.get(f.replace(".", "_"), 0) or 0)
            for f in aggregate_fields
        }
        return row["total"], sums

    async def get_batch_descendant_aggregates(
        self, ancestor_ids: Sequence[UUID], aggregate_fields: Sequence[str]
    ) -> dict[str, tuple[int, dict[str, float]]]:
        if not ancestor_ids:
            return {}

        base_filter = self._get_organization_filter()

        ids_str = ", ".join(f"'{str(aid)}'" for aid in ancestor_ids)
        ids_array: ColumnClause[str] = literal_column(f"[{ids_str}]")

        matched_ancestor = func.arrayJoin(
            func.arrayIntersect(events_table.c.ancestors, ids_array)
        ).label("matched_ancestor")

        columns: list[Any] = [matched_ancestor, func.count().label("total")]
        for field_path in aggregate_fields:
            label = field_path.replace(".", "_")
            col = DENORMALIZED_COLUMNS.get(field_path)
            if col is not None:
                columns.append(func.sum(col).label(label))
            else:
                parts = field_path.split(".")
                columns.append(
                    func.sum(
                        func.JSONExtractFloat(events_table.c.user_metadata, *parts)
                    ).label(label)
                )

        statement = (
            sqlalchemy.select(*columns)
            .select_from(events_table)
            .where(base_filter)
            .where(func.hasAny(events_table.c.ancestors, ids_array))
        )
        for f in self._filters:
            statement = statement.where(f)
        statement = statement.group_by(literal_column("matched_ancestor"))

        sql, template = _compile(statement)
        rows = await client.query(sql, db_statement=template)

        result: dict[str, tuple[int, dict[str, float]]] = {}
        for row in rows:
            aid = row["matched_ancestor"]
            total = row["total"]
            sums = {
                f.replace(".", "_"): float(row.get(f.replace(".", "_"), 0) or 0)
                for f in aggregate_fields
            }
            result[aid] = (total, sums)

        return result

    async def get_property_group_stats(
        self,
        property: str,
        aggregate_fields: Sequence[str] = ("_cost.amount",),
        limit: int = 200,
    ) -> list[TinybirdPropertyGroupStats]:
        base_filter = self._get_organization_filter()

        denorm_col = DENORMALIZED_COLUMNS.get(property)
        if denorm_col is not None:
            group_col = denorm_col
        else:
            parts = property.split(".")
            group_col = func.JSONExtractString(events_table.c.user_metadata, *parts)

        agg_columns: list[Any] = []
        for field_path in aggregate_fields:
            label = field_path.replace(".", "_")
            agg_denorm = DENORMALIZED_COLUMNS.get(field_path)
            if agg_denorm is not None:
                agg_columns.append(func.sum(agg_denorm).label(f"{label}_sum"))
            else:
                parts = field_path.split(".")
                agg_columns.append(
                    func.sum(
                        func.JSONExtractFloat(events_table.c.user_metadata, *parts)
                    ).label(f"{label}_sum")
                )

        statement = (
            sqlalchemy.select(
                group_col.label("value"),
                func.count().label("occurrences"),
                literal_column(
                    "uniqExact(if(customer_id IS NOT NULL,"
                    " toString(customer_id),"
                    " external_customer_id))"
                ).label("customers"),
                *agg_columns,
            )
            .select_from(events_table)
            .where(base_filter)
            .where(group_col != "")
            .group_by(group_col)
        )

        for f in self._filters:
            statement = statement.where(f)

        if aggregate_fields:
            first_label = aggregate_fields[0].replace(".", "_")
            statement = statement.order_by(literal_column(f"{first_label}_sum").desc())

        statement = statement.limit(limit)

        sql, template = _compile(statement)
        rows = await client.query(sql, db_statement=template)

        results = []
        for row in rows:
            totals = {
                f.replace(".", "_"): float(
                    row.get(f"{f.replace('.', '_')}_sum", 0) or 0
                )
                for f in aggregate_fields
            }
            results.append(
                TinybirdPropertyGroupStats(
                    value=str(row["value"]),
                    occurrences=int(row.get("occurrences", 0) or 0),
                    customers=int(row.get("customers", 0) or 0),
                    totals=totals,
                )
            )
        return results

    async def get_customer_stats(
        self,
        aggregate_fields: Sequence[str],
        limit: int = 200,
    ) -> list[TinybirdCustomerStat]:
        per_root = self._build_per_root_subquery(aggregate_fields)

        agg_columns: list[Any] = []
        for field_path in aggregate_fields:
            label = field_path.replace(".", "_")
            total_col = per_root.c[f"{label}_total"]
            agg_columns.append(func.sum(total_col).label(f"{label}_sum"))

        # Subquery that groups by customer and sums each aggregate field
        customer_sums = (
            sqlalchemy.select(
                per_root.c.customer_id.label("customer_id"),
                per_root.c.external_customer_id.label("external_customer_id"),
                func.count().label("occurrences"),
                *agg_columns,
            )
            .select_from(per_root)
            .group_by(per_root.c.customer_id, per_root.c.external_customer_id)
        ).subquery("customer_sums")

        # Primary field for ordering and share computation
        if aggregate_fields:
            primary_label = aggregate_fields[0].replace(".", "_")
            primary_col = customer_sums.c[f"{primary_label}_sum"]
            share_col = (primary_col / func.sum(primary_col).over()).label("share")
            order_col = primary_col.desc()
        else:
            share_col = sqlalchemy.literal(0.0).label("share")  # type: ignore[assignment]
            order_col = customer_sums.c.occurrences.desc()

        statement = (
            sqlalchemy.select(customer_sums, share_col).order_by(order_col).limit(limit)
        )

        sql, template = _compile(statement)
        rows = await client.query(sql, db_statement=template)

        results = []
        for row in rows:
            totals = {
                field_path.replace(".", "_"): float(
                    row.get(f"{field_path.replace('.', '_')}_sum", 0) or 0
                )
                for field_path in aggregate_fields
            }
            results.append(
                TinybirdCustomerStat(
                    customer_id=str(row["customer_id"])
                    if row.get("customer_id")
                    else None,
                    external_customer_id=row.get("external_customer_id") or None,
                    occurrences=int(row.get("occurrences", 0) or 0),
                    totals=totals,
                    share=_finite(row.get("share", 0)),
                )
            )
        return results

    async def get_variance_events(
        self,
        aggregate_fields: Sequence[str],
        limit: int = 100,
    ) -> list[TinybirdVarianceStat]:
        if not aggregate_fields:
            return []

        per_root = self._build_per_root_subquery(aggregate_fields)
        primary_label = aggregate_fields[0].replace(".", "_")
        primary_total = per_root.c[f"{primary_label}_total"]
        primary_total_sql = f"per_root.{primary_label}_total"

        # Subquery: per event name → avg and p99 of each aggregate field
        name_stats_cols: list[Any] = [
            per_root.c.root_name.label("name"),
            func.avg(primary_total).label(f"{primary_label}_avg"),
            literal_column(f"quantile(0.99)({primary_total_sql})").label(
                f"{primary_label}_p99"
            ),
        ]
        for field_path in aggregate_fields[1:]:
            fl = field_path.replace(".", "_")
            fc = per_root.c[f"{fl}_total"]
            fc_sql = f"per_root.{fl}_total"
            name_stats_cols.append(func.avg(fc).label(f"{fl}_avg"))
            name_stats_cols.append(
                literal_column(f"quantile(0.99)({fc_sql})").label(f"{fl}_p99")
            )

        name_stats = (
            sqlalchemy.select(*name_stats_cols)
            .select_from(per_root)
            .group_by(per_root.c.root_name)
        ).subquery("name_stats")

        value_cols: list[Any] = []
        stat_cols: list[Any] = [
            name_stats.c[f"{primary_label}_avg"],
            name_stats.c[f"{primary_label}_p99"],
        ]
        for field_path in aggregate_fields:
            fl = field_path.replace(".", "_")
            value_cols.append(per_root.c[f"{fl}_total"].label(f"{fl}_value"))
        for field_path in aggregate_fields[1:]:
            fl = field_path.replace(".", "_")
            stat_cols.append(name_stats.c[f"{fl}_avg"])
            stat_cols.append(name_stats.c[f"{fl}_p99"])

        statement = (
            sqlalchemy.select(
                per_root.c.root_id.label("event_id"),
                per_root.c.root_name.label("name"),
                per_root.c.customer_id.label("customer_id"),
                per_root.c.external_customer_id.label("external_customer_id"),
                per_root.c.root_timestamp.label("timestamp"),
                *value_cols,
                *stat_cols,
            )
            .select_from(per_root)
            .join(name_stats, per_root.c.root_name == name_stats.c.name)
            .where(primary_total >= name_stats.c[f"{primary_label}_p99"])
            .order_by(primary_total.desc())
            .limit(limit)
        )

        sql, template = _compile(statement)
        rows = await client.query(sql, db_statement=template)

        results = []
        for row in rows:
            values: dict[str, float] = {}
            averages: dict[str, float] = {}
            p99: dict[str, float] = {}
            for field_path in aggregate_fields:
                fl = field_path.replace(".", "_")
                values[fl] = float(row.get(f"{fl}_value", 0) or 0)
                averages[fl] = float(row.get(f"{fl}_avg", 0) or 0)
                p99[fl] = float(row.get(f"{fl}_p99", 0) or 0)
            results.append(
                TinybirdVarianceStat(
                    event_id=str(row["event_id"]),
                    name=str(row["name"]),
                    customer_id=str(row["customer_id"])
                    if row.get("customer_id")
                    else None,
                    external_customer_id=row.get("external_customer_id") or None,
                    timestamp=_parse_datetime(row["timestamp"]),
                    values=values,
                    averages=averages,
                    p99=p99,
                )
            )
        return results


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
            return _parse_event_type_stats(
                rows, organization_id=UUID(self._organization_id)
            )
        except Exception as e:
            log.error("tinybird.get_event_type_stats_from_mv.failed", error=str(e))
            raise
