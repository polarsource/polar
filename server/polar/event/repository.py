from collections.abc import Sequence
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import (
    ColumnElement,
    ColumnExpressionArgument,
    Select,
    and_,
    case,
    cast,
    func,
    literal_column,
    or_,
    over,
    select,
    text,
)
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import joinedload
from sqlalchemy.types import Numeric

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import RepositoryBase, RepositoryIDMixin
from polar.kit.repository.base import Options
from polar.kit.utils import generate_uuid
from polar.models import (
    BillingEntry,
    Customer,
    Event,
    EventClosure,
    Meter,
    UserOrganization,
)
from polar.models.event import EventSource
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
        aggregate_costs: bool = False,
    ) -> tuple[Sequence[Event], int]:
        """
        List events using closure table to get a correct children_count.
        Optionally aggregates costs from descendants into user_metadata._cost.amount.
        """
        descendant_event = Event.__table__.alias("descendant_event")

        # Build columns for aggregations CTE
        aggregation_columns: list[Any] = [
            EventClosure.ancestor_id,
            (func.count() - 1).label("descendant_count"),
        ]

        if aggregate_costs:
            pg_path = "{_cost,amount}"
            field_expr = cast(
                descendant_event.c.user_metadata.op("#>>")(
                    literal_column(f"'{pg_path}'")
                ),
                Numeric,
            )
            aggregation_columns.append(
                func.coalesce(func.sum(field_expr), 0).label("cost_sum")
            )

        aggregations_cte = (
            select(*aggregation_columns)
            .select_from(EventClosure)
            .join(descendant_event, EventClosure.descendant_id == descendant_event.c.id)
            .group_by(EventClosure.ancestor_id)
        ).cte("aggregations")

        metadata_expr = (
            case(
                (
                    aggregations_cte.c.cost_sum > 0,
                    case(
                        (
                            Event.user_metadata.op("?")("_cost"),
                            func.jsonb_set(
                                Event.user_metadata,
                                text("'{_cost,amount}'"),
                                func.to_jsonb(aggregations_cte.c.cost_sum),
                            ),
                        ),
                        else_=Event.user_metadata.op("||")(
                            func.jsonb_build_object(
                                "_cost",
                                func.jsonb_build_object(
                                    "amount",
                                    aggregations_cte.c.cost_sum,
                                    "currency",
                                    "usd",
                                ),
                            )
                        ),
                    ),
                ),
                else_=Event.user_metadata,
            )
            if aggregate_costs
            else Event.user_metadata
        )

        final_query = (
            statement.add_columns(
                func.coalesce(aggregations_cte.c.descendant_count, 0).label(
                    "child_count"
                ),
                metadata_expr.label("aggregated_metadata"),
                over(func.count()).label("total_count"),
            )
            .outerjoin(aggregations_cte, Event.id == aggregations_cte.c.ancestor_id)
            .options(*self.get_eager_options())
            .limit(limit)
            .offset((page - 1) * limit)
        )

        result = await self.session.execute(final_query)
        rows = result.all()

        events = []
        total_count = 0
        for row in rows:
            event = row[0]
            event.child_count = row.child_count
            if aggregate_costs:
                event.user_metadata = row.aggregated_metadata
            events.append(event)
            total_count = row.total_count

        return events, total_count
