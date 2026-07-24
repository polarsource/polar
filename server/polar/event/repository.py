from collections.abc import Sequence
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import (
    UUID as SA_UUID,
)
from sqlalchemy import (
    ColumnElement,
    ColumnExpressionArgument,
    Select,
    String,
    and_,
    cast,
    func,
    literal,
    or_,
    select,
    update,
)
from sqlalchemy.dialects.postgresql import aggregate_order_by, insert
from sqlalchemy.orm import joinedload

from polar.authz.types import AccessibleOrganizationID
from polar.kit.repository import RepositoryBase, RepositoryIDMixin
from polar.kit.repository.base import Options
from polar.kit.time_queries import TimeInterval, get_timestamp_series_cte
from polar.kit.utils import generate_uuid
from polar.models import (
    BillingEntry,
    Customer,
    Event,
    Meter,
    MeterEvent,
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

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[Event]]:
        statement = self.get_base_statement()
        statement = statement.where(Event.organization_id.in_(org_ids))
        return statement

    async def get_recent_balance_order_exchange_rate(
        self,
        organization_id: UUID,
        presentment_currency: str,
        *,
        before: datetime,
    ) -> float | None:
        # Cap how far back we'll reach. A months-old FX rate doesn't represent
        # the current value of credit, so prefer "no rate" (which the readers
        # know how to fall back from) over a stale one.
        since = before - timedelta(days=30)
        statement = (
            select(Event.user_metadata["exchange_rate"].as_string())
            .where(
                Event.organization_id == organization_id,
                Event.source == EventSource.system,
                Event.name == SystemEvent.balance_order.value,
                Event.user_metadata["presentment_currency"].as_string()
                == presentment_currency,
                Event.user_metadata["exchange_rate"].is_not(None),
                Event.timestamp < before,
                Event.timestamp >= since,
            )
            .order_by(Event.timestamp.desc())
            .limit(1)
        )
        result = await self.session.execute(statement)
        value = result.scalar_one_or_none()
        return float(value) if value is not None else None

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

    async def get_meter_billing_page(
        self,
        meter_id: UUID,
        *,
        after_ingested_at: datetime | None,
        after_event_id: UUID | None,
        limit: int,
    ) -> Sequence[tuple[Event, Customer | None]]:
        page_statement = (
            select(
                MeterEvent.event_id,
                MeterEvent.customer_id,
                MeterEvent.external_customer_id,
                MeterEvent.organization_id,
                MeterEvent.ingested_at,
            )
            .where(MeterEvent.meter_id == meter_id)
            .order_by(MeterEvent.ingested_at.asc(), MeterEvent.event_id.asc())
            .limit(limit)
        )
        if after_ingested_at is not None:
            assert after_event_id is not None
            page_statement = page_statement.where(
                or_(
                    MeterEvent.ingested_at > after_ingested_at,
                    and_(
                        MeterEvent.ingested_at == after_ingested_at,
                        MeterEvent.event_id > after_event_id,
                    ),
                )
            )

        event_page = page_statement.cte("meter_billing_event_page")
        resolved_customers = (
            select(
                event_page.c.event_id,
                event_page.c.ingested_at,
                event_page.c.customer_id.label("resolved_customer_id"),
            )
            .where(event_page.c.customer_id.is_not(None))
            .union_all(
                select(
                    event_page.c.event_id,
                    event_page.c.ingested_at,
                    Customer.id.label("resolved_customer_id"),
                )
                .join(
                    Customer,
                    and_(
                        Customer.external_id == event_page.c.external_customer_id,
                        Customer.organization_id == event_page.c.organization_id,
                    ),
                )
                .where(event_page.c.customer_id.is_(None))
            )
            .cte("meter_billing_resolved_customers")
        )
        statement = (
            select(Event, Customer)
            .join(event_page, event_page.c.event_id == Event.id)
            .outerjoin(
                resolved_customers,
                resolved_customers.c.event_id == event_page.c.event_id,
            )
            .outerjoin(
                Customer, Customer.id == resolved_customers.c.resolved_customer_id
            )
            .order_by(
                event_page.c.ingested_at.asc(),
                event_page.c.event_id.asc(),
            )
        )
        result = await self.session.execute(statement)
        return [(event, customer) for event, customer in result.all()]

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

    async def get_timestamp_series(
        self,
        start_timestamp: datetime,
        end_timestamp: datetime,
        interval: TimeInterval,
    ) -> list[datetime]:
        cte = get_timestamp_series_cte(start_timestamp, end_timestamp, interval)
        result = await self.session.execute(select(cte.c.timestamp))
        return [row[0] for row in result.all()]
