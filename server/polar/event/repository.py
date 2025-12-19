from collections.abc import Sequence
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import (
    ColumnElement,
    ColumnExpressionArgument,
    Numeric,
    Select,
    UnaryExpression,
    and_,
    asc,
    case,
    cast,
    desc,
    func,
    literal_column,
    or_,
    select,
    text,
)
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import aliased, joinedload

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.config import settings
from polar.kit.repository import RepositoryBase, RepositoryIDMixin
from polar.kit.repository.base import Options
from polar.kit.sorting import Sorting
from polar.kit.time_queries import TimeInterval
from polar.kit.utils import generate_uuid, utc_now
from polar.models import (
    BillingEntry,
    Customer,
    Event,
    EventType,
    Meter,
    UserOrganization,
)
from polar.models.event import EventClosure, EventSource
from polar.models.event_hyper import EventHyper
from polar.models.product_price import ProductPriceMeteredUnit

from .sorting import EventSortProperty
from .system import SystemEvent


class EventRepository(RepositoryBase[Event], RepositoryIDMixin[Event, UUID]):
    model = Event

    async def get_all_by_name(self, name: str) -> Sequence[Event]:
        statement = self.get_base_statement().where(Event.name == name)
        return await self.get_all(statement)

    async def get_all_by_organization(self, organization_id: UUID) -> Sequence[Event]:
        statement = self.get_base_statement().where(
            Event.organization_id == organization_id
        )
        return await self.get_all(statement)

    async def create(self, event: Event, flush: bool = False) -> Event:
        if settings.EVENTS_DUAL_WRITE_ENABLED:
            if event.id is None:
                event.id = generate_uuid()
            if event.ingested_at is None:
                event.ingested_at = utc_now()
            if event.timestamp is None:
                event.timestamp = utc_now()
            if event.user_metadata is None:
                event.user_metadata = {}

        created_event = await super().create(event, flush=flush)

        if settings.EVENTS_DUAL_WRITE_ENABLED:
            hyper_event = EventHyper(
                id=event.id,
                ingested_at=event.ingested_at,
                timestamp=event.timestamp,
                name=event.name,
                source=event.source,
                customer_id=event.customer_id,
                external_customer_id=event.external_customer_id,
                external_id=event.external_id,
                parent_id=event.parent_id,
                root_id=event.root_id,
                organization_id=event.organization_id,
                event_type_id=event.event_type_id,
                user_metadata=event.user_metadata,
            )
            self.session.add(hyper_event)
            if flush:
                await self.session.flush()

        return created_event

    async def insert_batch(
        self, events: Sequence[dict[str, Any]]
    ) -> tuple[Sequence[UUID], int]:
        if not events:
            return [], 0

        events_needing_parent_lookup = []

        # Set root_id for root events before insertion
        for event in events:
            if event.get("root_id") is not None:
                continue
            elif event.get("parent_id") is None:
                if event.get("id") is None:
                    event["id"] = generate_uuid()
                event["root_id"] = event["id"]
            else:
                # Child event without root_id - needs to be looked up from parent
                # This is a fail-safe in the event that we did not set this before calling
                # insert_batch
                events_needing_parent_lookup.append(event)

        # Look up root_id from parents for events that need it
        if events_needing_parent_lookup:
            parent_ids = {event["parent_id"] for event in events_needing_parent_lookup}
            result = await self.session.execute(
                select(Event.id, Event.root_id).where(Event.id.in_(parent_ids))
            )
            parent_root_map = {
                parent_id: root_id or parent_id for parent_id, root_id in result
            }

            for event in events_needing_parent_lookup:
                parent_id = event["parent_id"]
                event["root_id"] = parent_root_map.get(parent_id, parent_id)

        statement = (
            insert(Event)
            .on_conflict_do_nothing(index_elements=["external_id"])
            .returning(Event.id)
        )
        result = await self.session.execute(statement, events)
        inserted_ids = [row[0] for row in result.all()]

        duplicates_count = len(events) - len(inserted_ids)

        # Dual-write to hypertable if enabled
        if settings.EVENTS_DUAL_WRITE_ENABLED:
            # Pre-check for duplicates (TimescaleDB can't have unique index on external_id alone)
            external_ids = [e["external_id"] for e in events if e.get("external_id")]
            existing_external_ids: set[str] = set()
            if external_ids:
                result = await self.session.execute(
                    select(EventHyper.external_id).where(
                        EventHyper.external_id.in_(external_ids)
                    )
                )
                existing_external_ids = {row[0] for row in result}

            hyper_events = [
                e
                for e in events
                if not e.get("external_id")
                or e["external_id"] not in existing_external_ids
            ]
            if hyper_events:
                await self.session.execute(insert(EventHyper), hyper_events)

        return inserted_ids, duplicates_count

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
                        UserOrganization.deleted_at.is_(None),
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

    async def list_with_closure_table(
        self,
        statement: Select[tuple[Event]],
        limit: int,
        page: int,
        aggregate_fields: Sequence[str] = (),
        depth: int | None = None,
        parent_id: UUID | None = None,
        cursor_pagination: bool = False,
        sorting: Sequence[Sorting[EventSortProperty]] = (
            (EventSortProperty.timestamp, True),
        ),
    ) -> tuple[Sequence[Event], int]:
        """
        List events using closure table to get a correct children_count.
        Optionally aggregates fields from descendants's metadata.

        When depth is specified, returns events up to that depth from anchor events:
        - depth=0: root events only (or nothing if parent_id specified, since parent is excluded)
        - depth=1: roots + direct children (or just children if parent_id specified)
        - depth=N: roots + descendants up to N levels

        Anchor events are determined by parent_id:
        - If parent_id is set: returns descendants of that event (excludes the parent itself)
        - If parent_id is None: root events (parent_id IS NULL) are anchors (included in results)

        When depth is None, no hierarchy filtering is applied (returns all matching events).

        If cursor_pagination is True, returns (events, 1 if has_next_page else 0).
        Otherwise returns (events, total_count).
        """
        # Apply depth filtering using closure table only when depth is specified
        if depth is not None:
            if parent_id is not None:
                # Single anchor: the specified parent
                # Exclude the anchor itself (depth > 0) for backwards compatibility
                anchor_ids = select(Event.id).where(Event.id == parent_id)
                descendants_subquery = select(EventClosure.descendant_id).where(
                    EventClosure.ancestor_id.in_(anchor_ids),
                    EventClosure.depth > 0,
                    EventClosure.depth <= depth,
                )
            else:
                # Anchor: root events (those without parents)
                # Include the anchors themselves (depth >= 0)
                anchor_ids = statement.with_only_columns(Event.id).where(
                    Event.parent_id.is_(None)
                )
                descendants_subquery = select(EventClosure.descendant_id).where(
                    EventClosure.ancestor_id.in_(anchor_ids),
                    EventClosure.depth <= depth,
                )

            # Filter main statement to only include these events
            statement = statement.where(Event.id.in_(descendants_subquery))

        descendant_event = aliased(Event, name="descendant_event")

        # Step 1: Get paginated event IDs (with total count for legacy pagination)
        offset = (page - 1) * limit
        query_limit = limit + 1 if cursor_pagination else limit

        paginated_events_subquery = (
            statement.limit(query_limit).offset(offset)
        ).subquery("paginated_events")

        aggregation_columns: list[Any] = [
            EventClosure.ancestor_id,
            (func.count() - 1).label("descendant_count"),
        ]

        field_aggregations = {}
        for field_path in aggregate_fields:
            pg_path = "{" + field_path.replace(".", ",") + "}"
            label = f"agg_{field_path.replace('.', '_')}"

            # Only aggregate numeric fields by summing them
            # Returns NULL if no values to sum or if all values are NULL
            numeric_expr = cast(
                descendant_event.user_metadata.op("#>>")(
                    literal_column(f"'{pg_path}'")
                ),
                Numeric,
            )

            aggregation_columns.append(func.sum(numeric_expr).label(label))
            field_aggregations[field_path] = label

        paginated_event_id = paginated_events_subquery.c.id

        aggregations_lateral = (
            select(*aggregation_columns)
            .select_from(EventClosure)
            .join(descendant_event, EventClosure.descendant_id == descendant_event.id)
            .where(EventClosure.ancestor_id == paginated_event_id)
            .group_by(EventClosure.ancestor_id)
        ).lateral("aggregations")

        # Reference user_metadata from the paginated subquery
        paginated_user_metadata = paginated_events_subquery.c.user_metadata

        metadata_expr: Any = paginated_user_metadata
        if aggregate_fields:
            for field_path, label in field_aggregations.items():
                parts = field_path.split(".")
                pg_path = "{" + ",".join(parts) + "}"
                agg_column = getattr(aggregations_lateral.c, label)

                # For nested paths, jsonb_set with create_if_missing doesn't work reliably
                # Use deep merge approach: extract parent, merge, set back
                if len(parts) > 1:
                    # Build the full nested structure
                    # For "_cost.amount"=7: {"_cost": {"amount": 7}}
                    nested_value = func.to_jsonb(agg_column)
                    for part in reversed(parts):
                        nested_value = func.jsonb_build_object(part, nested_value)

                    # Deep merge: get existing parent object, merge with new, set back
                    parent_key = parts[0]
                    existing_parent = func.coalesce(
                        metadata_expr.op("->")(parent_key), text("'{}'::jsonb")
                    )
                    merged_parent = existing_parent.op("||")(
                        nested_value.op("->")(parent_key)
                    )

                    metadata_expr = func.jsonb_set(
                        metadata_expr,
                        text(f"'{{{parent_key}}}'"),
                        merged_parent,
                        text("true"),
                    )
                else:
                    # Simple top-level key
                    metadata_expr = func.jsonb_set(
                        metadata_expr,
                        text(f"'{pg_path}'"),
                        func.to_jsonb(agg_column),
                        text("true"),
                    )

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == EventSortProperty.timestamp:
                order_by_clauses.append(
                    clause_function(paginated_events_subquery.c.timestamp)
                )

        final_query = (
            select(Event)
            .select_from(paginated_events_subquery)
            .join(Event, Event.id == paginated_events_subquery.c.id)
            .add_columns(
                func.coalesce(aggregations_lateral.c.descendant_count, 0).label(
                    "child_count"
                ),
                metadata_expr.label("aggregated_metadata"),
            )
            .outerjoin(aggregations_lateral, literal_column("true"))
            .order_by(*order_by_clauses)
            .options(*self.get_eager_options())
        )

        result = await self.session.execute(final_query)
        rows = result.all()

        events = []
        for row in rows:
            event = row[0]
            event.child_count = row.child_count

            if aggregate_fields:
                aggregated = row.aggregated_metadata
                # If _cost exists but has None/missing fields, clean it up
                if "_cost" in aggregated:
                    cost_obj = aggregated.get("_cost")
                    if cost_obj is None or cost_obj.get("amount") is None:
                        # Remove incomplete _cost object entirely
                        del aggregated["_cost"]
                    elif "currency" not in cost_obj:
                        # Add default currency if missing
                        cost_obj["currency"] = "usd"  # FIXME: Main Polar currency

                event.user_metadata = aggregated

            # Expunge the event from the session to prevent modifications from being persisted
            # We're only modifying transient display fields (child_count, aggregated metadata)
            self.session.expunge(event)

            events.append(event)

        if cursor_pagination:
            has_next_page = 1 if len(events) > limit else 0
            return events[:limit], has_next_page

        # Run count query separately for better performance
        total_count = 0
        if len(events) > 0:
            count_statement = statement.with_only_columns(func.count()).order_by(None)
            count_result = await self.session.execute(count_statement)
            total_count = count_result.scalar() or 0

        return events, total_count

    async def get_with_aggregation(
        self,
        auth_subject: AuthSubject[User | Organization],
        id: UUID,
        aggregate_fields: Sequence[str],
    ) -> Event | None:
        """Get a single event with aggregated metadata from descendants."""
        statement = self.get_readable_statement(auth_subject).where(Event.id == id)

        events, _ = await self.list_with_closure_table(
            statement, limit=1, page=1, aggregate_fields=aggregate_fields
        )

        return events[0] if events else None

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
                timezone,
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
