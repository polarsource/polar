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
    cast,
    desc,
    func,
    literal_column,
    or_,
    over,
    select,
    text,
)
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import aliased, joinedload

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import RepositoryBase, RepositoryIDMixin
from polar.kit.repository.base import Options
from polar.kit.utils import generate_uuid
from polar.models import (
    BillingEntry,
    Customer,
    Event,
    Meter,
    UserOrganization,
)
from polar.models.event import EventClosure, EventSource
from polar.models.product_price import ProductPriceMeteredUnit

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

        return inserted_ids, duplicates_count

    async def get_latest_meter_reset(
        self, customer: Customer, meter_id: UUID
    ) -> Event | None:
        statement = (
            self.get_base_statement()
            .where(
                Event.customer == customer,
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
        return (joinedload(Event.customer),)

    async def list_with_closure_table(
        self,
        statement: Select[tuple[Event]],
        limit: int,
        page: int,
        aggregate_fields: Sequence[str] = (),
    ) -> tuple[Sequence[Event], int]:
        """
        List events using closure table to get a correct children_count.
        Optionally aggregates fields from descendants's metadata.
        """
        descendant_event = aliased(Event, name="descendant_event")

        # Step 1: Get paginated event IDs with total count
        offset = (page - 1) * limit

        paginated_events_subquery = (
            statement.add_columns(over(func.count()).label("total_count"))
            .limit(limit)
            .offset(offset)
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

        # Step 2: Join back to Event table to get full ORM objects with relationships
        final_query = (
            select(Event, paginated_events_subquery.c.total_count)
            .select_from(paginated_events_subquery)
            .join(Event, Event.id == paginated_events_subquery.c.id)
            .add_columns(
                func.coalesce(aggregations_lateral.c.descendant_count, 0).label(
                    "child_count"
                ),
                metadata_expr.label("aggregated_metadata"),
            )
            .outerjoin(aggregations_lateral, literal_column("true"))
            .options(*self.get_eager_options())
        )

        result = await self.session.execute(final_query)
        rows = result.all()

        events = []
        total_count = 0
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
            total_count = row.total_count

        return events, total_count

    async def get_hierarchy_stats(
        self,
        statement: Select[tuple[Event]],
        aggregate_fields: Sequence[str] = ("cost.amount",),
        sorting: Sequence[tuple[str, bool]] = (("total", True),),
    ) -> Sequence[dict[str, Any]]:
        """
        Get aggregate statistics grouped by root event name across all hierarchies.

        Args:
            statement: Base query for root events to include
            aggregate_fields: List of user_metadata field paths to aggregate
            sorting: List of (property, is_desc) tuples for sorting

        Returns:
            List of dicts containing name, occurrences, and statistics for each field
        """
        root_events_subquery = statement.where(Event.parent_id.is_(None)).subquery()

        descendant_event = aliased(Event, name="descendant_event")

        aggregation_exprs = []
        having_clauses = []
        for field_path in aggregate_fields:
            field_parts = field_path.split(".")
            pg_path = "{" + ",".join(field_parts) + "}"
            safe_field_name = field_path.replace(".", "_")

            field_expr = cast(
                descendant_event.user_metadata.op("#>>")(
                    literal_column(f"'{pg_path}'")
                ),
                Numeric,
            )

            sum_expr = func.sum(field_expr)

            aggregation_exprs.extend(
                [
                    sum_expr.label(f"{safe_field_name}_sum"),
                    func.avg(field_expr).label(f"{safe_field_name}_avg"),
                    func.percentile_cont(0.95)
                    .within_group(field_expr)
                    .label(f"{safe_field_name}_p95"),
                    func.percentile_cont(0.99)
                    .within_group(field_expr)
                    .label(f"{safe_field_name}_p99"),
                ]
            )

            having_clauses.append(sum_expr > 0)

        stats_query = (
            select(
                literal_column("root_event.name").label("name"),
                func.count(func.distinct(literal_column("root_event.id"))).label(
                    "occurrences"
                ),
                *aggregation_exprs,
            )
            .select_from(root_events_subquery.alias("root_event"))
            .join(
                EventClosure,
                literal_column("root_event.id") == EventClosure.ancestor_id,
            )
            .join(descendant_event, EventClosure.descendant_id == descendant_event.id)
            .group_by(literal_column("root_event.name"))
        )

        if having_clauses:
            stats_query = stats_query.having(or_(*having_clauses))

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc_sort in sorting:
            clause_function = desc if is_desc_sort else asc
            if criterion == "name":
                order_by_clauses.append(clause_function(text("name")))
            elif criterion == "occurrences":
                order_by_clauses.append(clause_function(text("occurrences")))
            elif criterion in ("total", "average", "p95", "p99"):
                if aggregate_fields:
                    safe_field_name = aggregate_fields[0].replace(".", "_")
                    suffix_map = {
                        "total": "sum",
                        "average": "avg",
                        "p95": "p95",
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

        return [
            {
                "name": row.name,
                "occurrences": row.occurrences,
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
                "p95": {
                    field.replace(".", "_"): getattr(
                        row, f"{field.replace('.', '_')}_p95"
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
            for row in rows
        ]
