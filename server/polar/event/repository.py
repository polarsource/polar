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

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
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
    UserOrganization,
)
from polar.models.event import EventSource
from polar.models.product_price import ProductPriceMeteredUnit

from .system import SystemEvent


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

    async def find_resolvable_parents(
        self, inserted_ids: Sequence[UUID]
    ) -> Sequence[tuple[UUID, UUID, UUID]]:
        """
        Find pending events that can now be resolved, scoped to a batch
        of just-inserted events.

        Uses a recursive CTE that walks DOWN from resolved parents through the
        pending chain. Handles both directions:
        - Newly inserted orphans whose parent already exists in the DB
        - Existing orphans whose parent was just inserted in this batch

        Events whose chain doesn't reach a resolved root are excluded.

        Returns a list of (event_id, parent_id, root_id) tuples.

        Equivalent SQL:

            WITH RECURSIVE chain(
                id, parent_id, root_id, external_id, organization_id
            ) AS (
                -- Base case: pending children whose parent is already resolved,
                -- scoped to the just-inserted batch on either side of the edge.
                SELECT
                    pending.id,
                    resolved.id AS parent_id,
                    COALESCE(resolved.root_id, resolved.id) AS root_id,
                    pending.external_id,
                    pending.organization_id
                FROM events AS pending
                JOIN events AS resolved
                  ON resolved.organization_id = pending.organization_id
                 AND resolved.pending_parent_external_id IS NULL
                 AND (
                        resolved.external_id = pending.pending_parent_external_id
                     OR CAST(resolved.id AS VARCHAR)
                          = pending.pending_parent_external_id
                     )
                WHERE pending.pending_parent_external_id IS NOT NULL
                  AND (
                        resolved.id IN (:inserted_ids)
                     OR pending.id IN (:inserted_ids)
                     )

                UNION ALL

                -- Recursive step: descendants whose parent is already in chain.
                SELECT
                    descendant.id,
                    chain.id AS parent_id,
                    chain.root_id,
                    descendant.external_id,
                    descendant.organization_id
                FROM events AS descendant
                JOIN chain
                  ON descendant.organization_id = chain.organization_id
                 AND (
                        chain.external_id
                          = descendant.pending_parent_external_id
                     OR CAST(chain.id AS VARCHAR)
                          = descendant.pending_parent_external_id
                     )
                WHERE descendant.pending_parent_external_id IS NOT NULL
            )
            SELECT id, parent_id, root_id FROM chain;
        """
        if not inserted_ids:
            return []

        events = Event.__table__
        resolved = events.alias("resolved")
        pending = events.alias("pending")
        descendant = events.alias("descendant")

        def _parent_match(
            parent_external_id: ColumnElement[str | None],
            parent_id: ColumnElement[UUID],
            child_pending: ColumnElement[str | None],
        ) -> ColumnElement[bool]:
            return or_(
                parent_external_id == child_pending,
                cast(parent_id, String) == child_pending,
            )

        # Base: first-level resolvable events — pending children whose parent is
        # already resolved. Scoped on either side of the edge so we catch both
        # "batch inserted the parent (unblocking a pre-existing orphan)" and
        # "batch inserted the pending child (whose parent already existed)".
        base = (
            select(
                pending.c.id,
                resolved.c.id.label("parent_id"),
                func.coalesce(resolved.c.root_id, resolved.c.id).label("root_id"),
                pending.c.external_id,
                pending.c.organization_id,
            )
            .join(
                resolved,
                and_(
                    resolved.c.organization_id == pending.c.organization_id,
                    resolved.c.pending_parent_external_id.is_(None),
                    _parent_match(
                        resolved.c.external_id,
                        resolved.c.id,
                        pending.c.pending_parent_external_id,
                    ),
                ),
            )
            .where(
                pending.c.pending_parent_external_id.is_not(None),
                or_(
                    resolved.c.id.in_(inserted_ids),
                    pending.c.id.in_(inserted_ids),
                ),
            )
        )

        chain = base.cte("chain", recursive=True)

        # Walk further down: descendants whose parent is already in the chain.
        recursive = (
            select(
                descendant.c.id,
                chain.c.id.label("parent_id"),
                chain.c.root_id,
                descendant.c.external_id,
                descendant.c.organization_id,
            )
            .join(
                chain,
                and_(
                    descendant.c.organization_id == chain.c.organization_id,
                    _parent_match(
                        chain.c.external_id,
                        chain.c.id,
                        descendant.c.pending_parent_external_id,
                    ),
                ),
            )
            .where(descendant.c.pending_parent_external_id.is_not(None))
        )
        chain = chain.union_all(recursive)

        statement = select(chain.c.id, chain.c.parent_id, chain.c.root_id)
        result = await self.session.execute(statement)
        return [(row[0], row[1], row[2]) for row in result.all()]

    async def resolve_parents(
        self, resolvable: Sequence[tuple[UUID, UUID, UUID]]
    ) -> None:
        """
        Apply parent resolutions. Takes a list of (event_id, parent_id, root_id)
        tuples as returned by find_resolvable_parents.
        """
        if not resolvable:
            return

        for event_id, parent_id, root_id in resolvable:
            await self.session.execute(
                update(Event)
                .where(Event.id == event_id)
                .values(
                    parent_id=parent_id,
                    root_id=root_id,
                    pending_parent_external_id=None,
                )
            )

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
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[str, EventSource, int, datetime, datetime]]:
        return (
            self.get_readable_statement(auth_subject)
            .with_only_columns(
                Event.name,
                Event.source,
                func.count(Event.id).label("occurrences"),
                func.min(Event.timestamp).label("first_seen"),
                func.max(Event.timestamp).label("last_seen"),
            )
            .group_by(Event.name, Event.source)
        )

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Event]]:
        statement = self.get_base_statement()

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                Event.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.is_deleted.is_(False),
                    )
                )
            )

        elif is_organization(auth_subject):
            statement = statement.where(
                Event.organization_id == auth_subject.subject.id
            )

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
