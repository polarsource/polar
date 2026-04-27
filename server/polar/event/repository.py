from collections.abc import Sequence
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import (
    UUID as SA_UUID,
)
from sqlalchemy import (
    ColumnElement,
    ColumnExpressionArgument,
    Numeric,
    Select,
    String,
    UnaryExpression,
    and_,
    asc,
    case,
    cast,
    desc,
    func,
    literal,
    literal_column,
    or_,
    select,
    text,
    update,
)
from sqlalchemy.dialects.postgresql import aggregate_order_by, insert
from sqlalchemy.orm import aliased, joinedload

from polar.authz.types import AccessibleOrganizationID
from polar.kit.repository import RepositoryBase, RepositoryIDMixin
from polar.kit.repository.base import Options
from polar.kit.time_queries import TimeInterval, get_timestamp_series_cte
from polar.kit.utils import generate_uuid
from polar.models import (
    BillingEntry,
    Customer,
    Event,
    EventType,
    Meter,
)
from polar.models.event import EventSource
from polar.models.product_price import ProductPriceMeteredUnit

from .system import SystemEvent

# Hard cap on parent_id chain depth traversed by resolve_pending_parents.
# Real chains are tens at most; this exists purely to bail out if a cycle
# (A.parent_id → B → A) ever sneaks into the data, instead of spinning until
# statement_timeout kills the worker.
_MAX_RESOLVE_DEPTH = 100


class EventRepository(RepositoryBase[Event], RepositoryIDMixin[Event, UUID]):
    model = Event

    # Note: this method is deprecated. Typically when you get_all you want to use
    # Tinybird instead of postgres.
    async def get_all_by_name(self, name: str) -> Sequence[Event]:
        statement = self.get_base_statement().where(Event.name == name)
        return await self.get_all(statement)

    # Note: this method is deprecated. Typically when you get_all you want to use
    # Tinybird instead of postgres.
    async def get_all_by_organization(self, organization_id: UUID) -> Sequence[Event]:
        statement = self.get_base_statement().where(
            Event.organization_id == organization_id
        )
        return await self.get_all(statement)

    async def insert_batch(
        self, events: Sequence[dict[str, Any]]
    ) -> tuple[Sequence[UUID], int]:
        if not events:
            return [], 0

        for event in events:
            if event.get("id") is None:
                event["id"] = generate_uuid()
            if event.get("pending_parent_external_id") is None:
                event["root_id"] = event["id"]

        statement = (
            insert(Event)
            .on_conflict_do_nothing(index_elements=["organization_id", "external_id"])
            .returning(Event.id)
        )
        result = await self.session.execute(statement, events)
        inserted_ids = [row[0] for row in result.all()]

        duplicates_count = len(events) - len(inserted_ids)

        return inserted_ids, duplicates_count

    async def resolve_pending_parents(
        self, inserted_ids: Sequence[UUID]
    ) -> Sequence[UUID]:
        """
        Resolve pending parents and propagate root_id for events affected by
        the just-inserted batch. Returns the IDs of events whose root_id was
        just set (chain now reaches a real root).

        All work is scoped to the batch — only edges with one side in the
        batch can be newly resolvable.

        Step 1: link parent_id wherever a pending ref now matches a parent
        row. Run as four UPDATEs to keep each plan cleanly indexed:
          1a — child in batch, parent in DB, ref by external_id
          1c — child in batch, parent in DB, ref by Polar ID (UUID)
          1b — parent in batch, child pending in DB, ref by external_id
          1d — parent in batch, child pending in DB, ref by Polar ID (UUID)

        Step 2: propagate root_id along parent_id edges with a single
        iterative UPDATE. Each round roots every event whose immediate
        parent is already rooted. Starting frontier = the batch; each
        subsequent round shifts the frontier to the events just rooted,
        so the scope stays bounded and we only touch relevant descendants.
        This covers both directions in one pass: batch events inherit
        root_id from rooted ancestors, and DB orphans inherit it from
        ancestors that just arrived in this batch.
        """
        if not inserted_ids:
            return []

        # parent_1a, parent_1b, parent_1c, parent_1d
        # are all four ways we can resolve pending_parent_id to parent_id
        # (pointing to a internal event ID).
        parent_1a = Event.__table__.alias("parent_1a")
        await self.session.execute(
            update(Event)
            .values(parent_id=parent_1a.c.id, pending_parent_external_id=None)
            .where(
                Event.organization_id == parent_1a.c.organization_id,
                Event.pending_parent_external_id == parent_1a.c.external_id,
                Event.id.in_(inserted_ids),
            )
        )

        batch_pending_rows = await self.session.execute(
            select(Event.id, Event.pending_parent_external_id).where(
                Event.id.in_(inserted_ids),
                Event.pending_parent_external_id.is_not(None),
            )
        )
        uuid_pending_in_batch: list[UUID] = []
        for event_id, pending_ref in batch_pending_rows.all():
            try:
                UUID(pending_ref)
            except (ValueError, TypeError):
                continue
            uuid_pending_in_batch.append(event_id)

        if uuid_pending_in_batch:
            parent_1b = Event.__table__.alias("parent_1b")
            await self.session.execute(
                update(Event)
                .values(parent_id=parent_1b.c.id, pending_parent_external_id=None)
                .where(
                    Event.organization_id == parent_1b.c.organization_id,
                    cast(Event.pending_parent_external_id, SA_UUID) == parent_1b.c.id,
                    Event.id.in_(uuid_pending_in_batch),
                )
            )

        parent_1c = Event.__table__.alias("parent_1c")
        await self.session.execute(
            update(Event)
            .values(parent_id=parent_1c.c.id, pending_parent_external_id=None)
            .where(
                Event.organization_id == parent_1c.c.organization_id,
                Event.pending_parent_external_id.is_not(None),
                Event.pending_parent_external_id == parent_1c.c.external_id,
                parent_1c.c.id.in_(inserted_ids),
            )
        )

        # Pending refs are matched against the canonical lowercase string of
        # batch ids; non-canonical (e.g. uppercase) refs won't link here, but
        # `str(uuid.uuid4())` is always lowercase and that's what callers emit.
        parent_1d = Event.__table__.alias("parent_1d")
        await self.session.execute(
            update(Event)
            .values(parent_id=parent_1d.c.id, pending_parent_external_id=None)
            .where(
                Event.organization_id == parent_1d.c.organization_id,
                Event.pending_parent_external_id.is_not(None),
                Event.pending_parent_external_id == cast(parent_1d.c.id, String),
                parent_1d.c.id.in_(inserted_ids),
            )
        )

        frontier: set[UUID] = set(inserted_ids)
        newly_rooted: list[UUID] = []
        for _ in range(_MAX_RESOLVE_DEPTH):
            if not frontier:
                break
            parent_alias = Event.__table__.alias("p_root")
            result = await self.session.execute(
                update(Event)
                .values(root_id=parent_alias.c.root_id)
                .where(
                    or_(Event.id.in_(frontier), Event.parent_id.in_(frontier)),
                    Event.root_id.is_(None),
                    Event.parent_id == parent_alias.c.id,
                    parent_alias.c.root_id.is_not(None),
                )
                .returning(Event.id)
            )
            newly = [row[0] for row in result.all()]
            if not newly:
                break
            newly_rooted.extend(newly)
            frontier = set(newly)

        return newly_rooted

    async def get_latest_polar_self_ingestion_timestamp(
        self, organization_id: UUID
    ) -> datetime | None:
        statement = select(func.max(Event.timestamp)).where(
            Event.organization_id == organization_id,
            Event.name == "event_ingestion",
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def count_user_events_by_organization(
        self,
        *,
        after: datetime | None,
        until: datetime,
        exclude_organization_id: UUID,
    ) -> dict[UUID, int]:
        statement = (
            select(Event.organization_id, func.count(Event.id))
            .where(
                Event.source == EventSource.user,
                Event.organization_id != exclude_organization_id,
                Event.ingested_at <= until,
            )
            .group_by(Event.organization_id)
        )
        if after is not None:
            statement = statement.where(Event.ingested_at > after)
        result = await self.session.execute(statement)
        return {row[0]: row[1] for row in result.all()}

    async def get_latest_meter_reset(
        self, customer: Customer, meter_id: UUID
    ) -> Event | None:
        statement = (
            self.get_base_statement()
            .where(
                Event.customer_id == customer.id,
                Event.source == EventSource.system,
                Event.name == SystemEvent.meter_reset,
                Event.user_metadata["meter_id"].as_string() == str(meter_id),
            )
            .order_by(Event.timestamp.desc())
            .limit(1)
        )
        return await self.get_one_or_none(statement)

    def get_event_names_statement(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[str, EventSource, int, datetime, datetime]]:
        return (
            self.get_statement_by_org_ids(org_ids)
            .with_only_columns(
                Event.name,
                Event.source,
                func.count(Event.id).label("occurrences"),
                func.min(Event.timestamp).label("first_seen"),
                func.max(Event.timestamp).label("last_seen"),
            )
            .group_by(Event.name, Event.source)
        )

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[Event]]:
        statement = self.get_base_statement()
        statement = statement.where(Event.organization_id.in_(org_ids))
        return statement

    def get_customer_id_filter_clause(
        self, customer_id: Sequence[UUID]
    ) -> ColumnElement[bool]:
        return or_(
            Event.customer_id.in_(customer_id),
            Event.external_customer_id.in_(
                select(Customer.external_id).where(Customer.id.in_(customer_id))
            ),
        )

    def get_external_customer_id_filter_clause(
        self, external_customer_id: Sequence[str]
    ) -> ColumnElement[bool]:
        return or_(
            Event.external_customer_id.in_(external_customer_id),
            Event.customer_id.in_(
                select(Customer.id).where(
                    Customer.external_id.in_(external_customer_id)
                )
            ),
        )

    def get_meter_clause(self, meter: Meter) -> ColumnExpressionArgument[bool]:
        return and_(
            meter.filter.get_sql_clause(Event),
            # Additional clauses to make sure we work on rows with the right type for aggregation
            meter.aggregation.get_sql_clause(Event),
        )

    def get_meter_system_clause(self, meter: Meter) -> ColumnExpressionArgument[bool]:
        return and_(
            Event.source == EventSource.system,
            Event.name.in_((SystemEvent.meter_credited, SystemEvent.meter_reset)),
            Event.user_metadata["meter_id"].as_string() == str(meter.id),
        )

    def get_meter_statement(self, meter: Meter) -> Select[tuple[Event]]:
        return self.get_base_statement().where(
            Event.organization_id == meter.organization_id,
            self.get_meter_clause(meter),
        )

    def get_by_pending_entries_statement(
        self, subscription: UUID, price: UUID
    ) -> Select[tuple[Event]]:
        return (
            self.get_base_statement()
            .join(BillingEntry, Event.id == BillingEntry.event_id)
            .where(
                BillingEntry.subscription_id == subscription,
                BillingEntry.order_item_id.is_(None),
                BillingEntry.product_price_id == price,
            )
            .order_by(Event.ingested_at.asc())
        )

    def get_by_pending_entries_for_meter_statement(
        self, subscription: UUID, meter: UUID
    ) -> Select[tuple[Event]]:
        """
        Get events for pending billing entries grouped by meter.
        Used for non-summable aggregations where we need to compute across all events
        in the period, regardless of which price was active when the event occurred.
        """
        return (
            self.get_base_statement()
            .join(BillingEntry, Event.id == BillingEntry.event_id)
            .join(
                ProductPriceMeteredUnit,
                BillingEntry.product_price_id == ProductPriceMeteredUnit.id,
            )
            .where(
                BillingEntry.subscription_id == subscription,
                BillingEntry.order_item_id.is_(None),
                ProductPriceMeteredUnit.meter_id == meter,
            )
            .order_by(Event.ingested_at.asc())
        )

    def get_eager_options(self) -> Options:
        return (joinedload(Event.customer), joinedload(Event.event_types))

    async def get_by_id_with_eager(self, id: UUID) -> Event | None:
        statement = (
            self.get_base_statement()
            .where(Event.id == id)
            .options(*self.get_eager_options())
        )
        return await self.get_one_or_none(statement)

    async def get_by_ids_with_eager(
        self, ids: Sequence[UUID], organization_ids: Sequence[UUID]
    ) -> list[Event]:
        if not ids:
            return []
        statement = (
            self.get_base_statement()
            .where(Event.id.in_(ids), Event.organization_id.in_(organization_ids))
            .options(*self.get_eager_options())
        )
        results = await self.get_all(statement)
        order = {id: i for i, id in enumerate(ids)}
        return sorted(results, key=lambda e: order.get(e.id, 0))

    async def get_ancestors_batch(
        self, event_ids: Sequence[UUID]
    ) -> dict[UUID, list[str]]:
        if not event_ids:
            return {}

        anchor = select(
            Event.id.label("event_id"),
            Event.parent_id.label("ancestor_id"),
            literal(1).label("depth"),
        ).where(Event.id.in_(event_ids), Event.parent_id.is_not(None))

        cte = anchor.cte("ancestor_chain", recursive=True)
        parent = Event.__table__.alias("parent")
        recursive = (
            select(
                cte.c.event_id,
                parent.c.parent_id.label("ancestor_id"),
                (cte.c.depth + 1).label("depth"),
            )
            .select_from(cte.join(parent, cte.c.ancestor_id == parent.c.id))
            .where(parent.c.parent_id.is_not(None))
        )
        cte = cte.union_all(recursive)

        statement = select(
            cte.c.event_id,
            func.array_agg(
                aggregate_order_by(cte.c.ancestor_id, cte.c.depth.asc()),
                type_=SA_UUID(),
            ).label("ancestors"),
        ).group_by(cte.c.event_id)

        result = await self.session.execute(statement)
        return {
            row.event_id: [str(aid) for aid in row.ancestors] for row in result.all()
        }

    async def get_hierarchy_stats(
        self,
        statement: Select[tuple[Event]],
        aggregate_fields: Sequence[str] = ("cost.amount",),
        sorting: Sequence[tuple[str, bool]] = (("total", True),),
        timestamp_series: Any = None,
        interval: TimeInterval | None = None,
        timezone: str | None = None,
    ) -> Sequence[dict[str, Any]]:
        """
        Get aggregate statistics grouped by root event name across all hierarchies.

        Uses root_id for efficient rollup and joins with event_types for labels:
        1. Filter root events based on statement
        2. Roll up costs from all events in each hierarchy (via root_id)
        3. Calculate avg, p10, p90, p99 on those rolled-up totals across root events with same name
        4. Join with event_types to include labels

        Args:
            statement: Base query for root events to include
            aggregate_fields: List of user_metadata field paths to aggregate
            sorting: List of (property, is_desc) tuples for sorting
            timestamp_series: Optional CTE for time bucketing. If provided, stats are grouped by timestamp.
            interval: Time interval for bucketing (required when timestamp_series is provided)
            timezone: Timezone for date_trunc (required when timestamp_series is provided)

        Returns:
            List of dicts containing name, label, occurrences, and statistics for each field.
            If timestamp_series is provided, also includes timestamp for each row.
        """
        root_events_subquery = (
            statement.where(
                and_(Event.parent_id.is_(None), Event.source == EventSource.user)
            )
            .order_by(None)
            .subquery()
        )

        all_events = aliased(Event, name="all_events")
        customer = aliased(Customer, name="customer")

        bucket_expr: ColumnElement[datetime] | None = None
        if (
            timestamp_series is not None
            and interval is not None
            and timezone is not None
        ):
            bucket_expr = func.date_trunc(
                interval.value,
                literal_column("root_event.timestamp"),
                literal_column(f"'{timezone}'"),
            )

        per_root_select_exprs: list[ColumnElement[Any]] = [
            literal_column("root_event.id").label("root_id"),
            literal_column("root_event.name").label("root_name"),
            literal_column("root_event.organization_id").label("root_org_id"),
            customer.id.label("customer_id"),
            literal_column("root_event.external_customer_id").label(
                "external_customer_id"
            ),
        ]

        if bucket_expr is not None:
            per_root_select_exprs.append(bucket_expr.label("bucket"))

        for field_path in aggregate_fields:
            field_parts = field_path.split(".")
            pg_path = "{" + ",".join(field_parts) + "}"
            safe_field_name = field_path.replace(".", "_")

            field_expr = cast(
                all_events.user_metadata.op("#>>")(literal_column(f"'{pg_path}'")),
                Numeric,
            )

            sum_expr = func.sum(field_expr).label(f"{safe_field_name}_total")
            per_root_select_exprs.append(sum_expr)

        group_by_exprs: list[ColumnElement[Any]] = [
            literal_column("root_event.id"),
            literal_column("root_event.name"),
            literal_column("root_event.organization_id"),
            literal_column("customer.id"),
            literal_column("root_event.external_customer_id"),
        ]
        if bucket_expr is not None:
            group_by_exprs.append(bucket_expr)

        per_root_query = (
            select(*per_root_select_exprs)
            .select_from(root_events_subquery.alias("root_event"))
            .join(all_events, all_events.root_id == literal_column("root_event.id"))
            .outerjoin(
                customer,
                or_(
                    customer.id == literal_column("root_event.customer_id"),
                    and_(
                        customer.external_id
                        == literal_column("root_event.external_customer_id"),
                        customer.organization_id
                        == literal_column("root_event.organization_id"),
                    ),
                ),
            )
            .group_by(*group_by_exprs)
        )

        per_root_subquery = per_root_query.subquery("per_root_totals")

        event_type = aliased(EventType, name="event_type")

        if timestamp_series is not None:
            timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp

            aggregation_exprs = []
            for field_path in aggregate_fields:
                safe_field_name = field_path.replace(".", "_")
                total_col: ColumnElement[Any] = getattr(
                    per_root_subquery.c, f"{safe_field_name}_total"
                )

                aggregation_exprs.extend(
                    [
                        func.sum(total_col).label(f"{safe_field_name}_sum"),
                        func.avg(func.coalesce(total_col, 0)).label(
                            f"{safe_field_name}_avg"
                        ),
                        func.percentile_cont(0.10)
                        .within_group(func.coalesce(total_col, 0))
                        .label(f"{safe_field_name}_p10"),
                        func.percentile_cont(0.90)
                        .within_group(func.coalesce(total_col, 0))
                        .label(f"{safe_field_name}_p90"),
                        func.percentile_cont(0.99)
                        .within_group(func.coalesce(total_col, 0))
                        .label(f"{safe_field_name}_p99"),
                    ]
                )

            stats_query = (
                select(
                    timestamp_column.label("timestamp"),
                    per_root_subquery.c.root_name.label("name"),
                    event_type.id.label("event_type_id"),
                    event_type.label.label("label"),
                    func.count(
                        getattr(
                            per_root_subquery.c,
                            f"{aggregate_fields[0].replace('.', '_')}_total",
                        )
                    ).label("occurrences"),
                    (
                        func.count(per_root_subquery.c.customer_id.distinct())
                        + func.count(
                            case(
                                (
                                    per_root_subquery.c.customer_id.is_(None),
                                    per_root_subquery.c.external_customer_id,
                                )
                            ).distinct()
                        )
                    ).label("customers"),
                    *aggregation_exprs,
                )
                .select_from(
                    timestamp_series.outerjoin(
                        per_root_subquery,
                        per_root_subquery.c.bucket == timestamp_column,
                    )
                )
                .outerjoin(
                    event_type,
                    and_(
                        event_type.name == per_root_subquery.c.root_name,
                        event_type.organization_id == per_root_subquery.c.root_org_id,
                    ),
                )
                .group_by(
                    timestamp_column,
                    per_root_subquery.c.root_name,
                    event_type.id,
                    event_type.label,
                )
            )
        else:
            aggregation_exprs = []
            for field_path in aggregate_fields:
                safe_field_name = field_path.replace(".", "_")
                total_col_ref: ColumnElement[Any] = literal_column(
                    f"{safe_field_name}_total"
                )

                aggregation_exprs.extend(
                    [
                        func.sum(total_col_ref).label(f"{safe_field_name}_sum"),
                        func.avg(func.coalesce(total_col_ref, 0)).label(
                            f"{safe_field_name}_avg"
                        ),
                        func.percentile_cont(0.10)
                        .within_group(func.coalesce(total_col_ref, 0))
                        .label(f"{safe_field_name}_p10"),
                        func.percentile_cont(0.90)
                        .within_group(func.coalesce(total_col_ref, 0))
                        .label(f"{safe_field_name}_p90"),
                        func.percentile_cont(0.99)
                        .within_group(func.coalesce(total_col_ref, 0))
                        .label(f"{safe_field_name}_p99"),
                    ]
                )

            stats_query = (
                select(
                    per_root_subquery.c.root_name.label("name"),
                    event_type.id.label("event_type_id"),
                    event_type.label.label("label"),
                    func.count(per_root_subquery.c.root_id).label("occurrences"),
                    (
                        func.count(per_root_subquery.c.customer_id.distinct())
                        + func.count(
                            case(
                                (
                                    per_root_subquery.c.customer_id.is_(None),
                                    per_root_subquery.c.external_customer_id,
                                )
                            ).distinct()
                        )
                    ).label("customers"),
                    *aggregation_exprs,
                )
                .select_from(per_root_subquery)
                .outerjoin(
                    event_type,
                    and_(
                        event_type.name == per_root_subquery.c.root_name,
                        event_type.organization_id == per_root_subquery.c.root_org_id,
                    ),
                )
                .group_by(
                    per_root_subquery.c.root_name, event_type.id, event_type.label
                )
            )

        order_by_clauses: list[UnaryExpression[Any]] = []

        if timestamp_series is not None:
            order_by_clauses.append(asc(text("timestamp")))

        for criterion, is_desc_sort in sorting:
            clause_function = desc if is_desc_sort else asc
            if criterion == "name":
                order_by_clauses.append(clause_function(text("name")))
            elif criterion == "occurrences":
                order_by_clauses.append(clause_function(text("occurrences")))
            elif criterion in ("total", "average", "p10", "p90", "p99"):
                if aggregate_fields:
                    safe_field_name = aggregate_fields[0].replace(".", "_")
                    suffix_map = {
                        "total": "sum",
                        "average": "avg",
                        "p10": "p10",
                        "p90": "p90",
                        "p99": "p99",
                    }
                    suffix = suffix_map[criterion]
                    order_by_clauses.append(
                        clause_function(text(f"{safe_field_name}_{suffix}"))
                    )

        if order_by_clauses:
            stats_query = stats_query.order_by(*order_by_clauses)

        result = await self.session.execute(stats_query)
        rows = result.all()

        result_list = []
        for row in rows:
            row_dict = {
                "name": row.name,
                "label": row.label,
                "event_type_id": row.event_type_id,
                "occurrences": row.occurrences,
                "customers": row.customers,
                "totals": {
                    field.replace(".", "_"): getattr(
                        row, f"{field.replace('.', '_')}_sum"
                    )
                    or 0
                    for field in aggregate_fields
                },
                "averages": {
                    field.replace(".", "_"): getattr(
                        row, f"{field.replace('.', '_')}_avg"
                    )
                    or 0
                    for field in aggregate_fields
                },
                "p10": {
                    field.replace(".", "_"): getattr(
                        row, f"{field.replace('.', '_')}_p10"
                    )
                    or 0
                    for field in aggregate_fields
                },
                "p90": {
                    field.replace(".", "_"): getattr(
                        row, f"{field.replace('.', '_')}_p90"
                    )
                    or 0
                    for field in aggregate_fields
                },
                "p99": {
                    field.replace(".", "_"): getattr(
                        row, f"{field.replace('.', '_')}_p99"
                    )
                    or 0
                    for field in aggregate_fields
                },
            }

            if timestamp_series is not None:
                row_dict["timestamp"] = row.timestamp

            result_list.append(row_dict)

        return result_list

    async def get_timestamp_series(
        self,
        start_timestamp: datetime,
        end_timestamp: datetime,
        interval: TimeInterval,
    ) -> list[datetime]:
        cte = get_timestamp_series_cte(start_timestamp, end_timestamp, interval)
        result = await self.session.execute(select(cte.c.timestamp))
        return [row[0] for row in result.all()]
