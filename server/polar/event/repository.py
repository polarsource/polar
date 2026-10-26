from collections.abc import Collection, Mapping, Sequence
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
    case,
    cast,
    delete,
    func,
    literal,
    or_,
    select,
    tuple_,
    union_all,
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
    StagedEvent,
)
from polar.models.event import EventSource
from polar.models.product_price import ProductPrice

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
        self, events: Sequence[dict[str, Any]], *, render_nulls: bool = False
    ) -> tuple[Sequence[UUID], int]:
        if not events:
            return [], 0

        for event in events:
            if event.get("id") is None:
                event["id"] = generate_uuid()
            if event.get("pending_parent_external_id") is None:
                event["root_id"] = event["id"]

        # Ensure all event dicts have the same keys; add left out keys with None values.
        # We do this so SQLAlchemy bulk inserts these rows instead of doing separate
        # inserts for each event. Requires `render_nulls=True`, otherwise the None keys
        # are dropped again.
        keys = set().union(*events)
        for event in events:
            for key in keys:
                event.setdefault(key, None)

        statement = (
            insert(Event)
            .on_conflict_do_nothing(index_elements=["organization_id", "external_id"])
            .returning(Event.id)
        )
        if render_nulls:
            statement = statement.execution_options(render_nulls=True)
        result = await self.session.execute(statement, events)
        inserted_ids = [row[0] for row in result.all()]

        duplicates_count = len(events) - len(inserted_ids)

        return inserted_ids, duplicates_count

    async def insert_staged_batch(
        self, events: Sequence[dict[str, Any]]
    ) -> tuple[Sequence[UUID], int]:
        """Insert user events into `staged_events`, skipping those whose external ID
        is already in `staged_events` or `events`."""
        if not events:
            return [], 0

        for event in events:
            if event.get("id") is None:
                event["id"] = generate_uuid()
        keys = set().union(*events)
        for event in events:
            for key in keys:
                event.setdefault(key, None)

        statement = (
            insert(StagedEvent)
            .on_conflict_do_nothing(
                index_elements=["organization_id", "external_id"],
                index_where=StagedEvent.external_id.is_not(None),
            )
            .returning(
                StagedEvent.id, StagedEvent.organization_id, StagedEvent.external_id
            )
            .execution_options(render_nulls=True)
        )
        result = await self.session.execute(statement, events)
        inserted = result.all()

        # Drop the inserted rows whose external ID is already in `events`: the
        # unique index only catches duplicates still in `staged_events`. This is
        # its own statement after the insert because an insert racing the mover
        # on the same external ID waits for the mover to commit, and only a
        # snapshot taken after that wait sees the moved row in `events`.
        external_ids_by_organization: dict[UUID, list[str]] = {}
        for _, organization_id, external_id in inserted:
            if external_id is not None:
                external_ids_by_organization.setdefault(organization_id, []).append(
                    external_id
                )
        duplicate_ids: list[UUID] = []
        for organization_id, external_ids in external_ids_by_organization.items():
            moved = await self.session.execute(
                delete(StagedEvent)
                .where(
                    StagedEvent.organization_id == organization_id,
                    StagedEvent.external_id.in_(
                        select(Event.external_id).where(
                            Event.organization_id == organization_id,
                            Event.external_id.in_(external_ids),
                        )
                    ),
                )
                .returning(StagedEvent.id)
            )
            duplicate_ids.extend(moved.scalars())

        duplicate_id_set = set(duplicate_ids)
        inserted_ids = [id for id, _, _ in inserted if id not in duplicate_id_set]
        return inserted_ids, len(events) - len(inserted_ids)

    async def get_staged_events_backlog(self) -> tuple[int, datetime | None]:
        """Return the number of rows in `staged_events` and the oldest `ingested_at`."""
        result = await self.session.execute(
            select(func.count(), func.min(StagedEvent.ingested_at))
        )
        count, oldest_ingested_at = result.one()
        return count, oldest_ingested_at

    async def move_staged_events(self, limit: int) -> tuple[int, Sequence[UUID]]:
        """Move up to `limit` rows from `staged_events` to `events`, returning how
        many were moved and the IDs inserted into `events`."""
        claimed = (
            select(StagedEvent.id)
            .limit(limit)
            .with_for_update(skip_locked=True)
            .scalar_subquery()
        )
        moved = (
            delete(StagedEvent)
            .where(StagedEvent.id.in_(claimed))
            .returning(*StagedEvent.__table__.columns)
            .cte("moved")
        )
        columns = [column.name for column in StagedEvent.__table__.columns]
        inserted = (
            insert(Event)
            .from_select(
                [*columns, "root_id"],
                select(
                    *(moved.c[name] for name in columns),
                    case(
                        (moved.c.pending_parent_external_id.is_(None), moved.c.id),
                        else_=None,
                    ),
                ),
            )
            .on_conflict_do_nothing()
            .returning(Event.id)
            .cte("inserted")
        )
        statement = select(
            select(func.count()).select_from(moved).scalar_subquery(),
            select(func.array_agg(inserted.c.id)).scalar_subquery(),
        )
        result = await self.session.execute(statement)
        moved_count, inserted_ids = result.one()
        return moved_count, inserted_ids or []

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
                Event.id != parent_1a.c.id,
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
            except ValueError, TypeError:
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
                    Event.id != parent_1b.c.id,
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
                Event.id != parent_1c.c.id,
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
                Event.id != parent_1d.c.id,
                # Implied by the cast match above; only makes the planner use
                # ix_events_org_pending_parent instead of scanning all pending rows
                Event.pending_parent_external_id.in_(
                    [str(event_id) for event_id in inserted_ids]
                ),
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

    async def get_stored_external_ids(
        self,
        organization_id: UUID,
        external_ids: Sequence[str],
        *,
        timestamp_from: datetime,
        timestamp_to: datetime,
    ) -> set[str]:
        """The given external ids of events with a timestamp in the range, stored
        or still staged."""
        statement = union_all(
            *(
                select(model.external_id).where(
                    model.organization_id == organization_id,
                    model.external_id.in_(external_ids),
                    model.timestamp >= timestamp_from,
                    model.timestamp < timestamp_to,
                )
                for model in (Event, StagedEvent)
            )
        )
        result = await self.session.execute(statement)
        return {external_id for (external_id,) in result}

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
        self,
        customer: Customer,
        meter_id: UUID,
        *,
        cutoff: datetime | None = None,
    ) -> Event | None:
        statement = (
            self.get_base_statement()
            .where(
                Event.organization_id == customer.organization_id,
                Event.customer_id == customer.id,
                Event.source == EventSource.system,
                Event.name == SystemEvent.meter_reset,
                Event.user_metadata["meter_id"].as_string() == str(meter_id),
            )
            .order_by(Event.timestamp.desc())
            .limit(1)
        )
        if cutoff is not None:
            statement = statement.where(Event.timestamp < cutoff)
        return await self.get_one_or_none(statement)

    async def has_meter_reset_ingested_after(
        self, customer: Customer, meter_id: UUID, ingested_after: datetime
    ) -> bool:
        statement = select(
            self.get_base_statement()
            .where(
                Event.customer_id == customer.id,
                Event.source == EventSource.system,
                Event.name == SystemEvent.meter_reset,
                Event.user_metadata["meter_id"].as_string() == str(meter_id),
                Event.ingested_at > ingested_after,
            )
            .exists()
        )
        result = await self.session.execute(statement)
        return result.scalar_one()

    async def get_first_user_event_timestamp(
        self, customer: Customer
    ) -> datetime | None:
        """
        Earliest `user` event timestamp for a customer, straight from Postgres.

        The comparator matches on `customer_id` and on `external_customer_id`, so this
        also covers events ingested before the customer row existed.
        """
        statement = select(func.min(Event.timestamp)).where(
            Event.organization_id == customer.organization_id,
            Event.source == EventSource.user,
            Event.customer == customer,
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    def get_customer_filter_clause(
        self,
        organization_id: UUID,
        customer_id: Collection[UUID],
        external_customer_id: Collection[str],
    ) -> ColumnElement[bool]:
        return and_(
            Event.organization_id == organization_id,
            or_(
                Event.customer_id.in_(customer_id),
                Event.external_customer_id.in_(external_customer_id),
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
                tuple_(MeterEvent.ingested_at, MeterEvent.event_id)
                > (after_ingested_at, after_event_id)
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

    def _pending_entries_clauses(
        self,
        subscription: UUID,
        price: UUID,
        *,
        cutoff: datetime,
    ) -> tuple[ColumnExpressionArgument[bool], ...]:
        return (
            BillingEntry.subscription_id == subscription,
            BillingEntry.deleted_at.is_(None),
            BillingEntry.order_item_id.is_(None),
            BillingEntry.product_price_id == price,
            BillingEntry.start_timestamp < cutoff,
            BillingEntry.created_at <= cutoff,
        )

    def get_by_pending_entries_statement(
        self,
        subscription: UUID,
        price: UUID,
        *,
        cutoff: datetime,
    ) -> Select[tuple[Event]]:
        statement = (
            self.get_base_statement()
            .join(BillingEntry, Event.id == BillingEntry.event_id)
            .where(*self._pending_entries_clauses(subscription, price, cutoff=cutoff))
            .order_by(Event.ingested_at.asc())
        )
        return statement

    async def count_pending_entries(
        self,
        subscription: UUID,
        price: UUID,
        *,
        cutoff: datetime,
    ) -> int:
        """
        Count the pending billing entries for a price without joining `events`.

        There is exactly one billing entry per event, so for a `count` meter this is
        the consumed quantity. Counting the entries directly avoids fanning the scan
        out into a per-event primary-key lookup on `events`, which times out for
        high-volume subscriptions. System events (meter.credited, meter.reset) also
        produce entries and must be excluded via `count_pending_system_entries`.
        """
        statement = (
            select(func.count())
            .select_from(BillingEntry)
            .where(*self._pending_entries_clauses(subscription, price, cutoff=cutoff))
        )
        return await self.session.scalar(statement) or 0

    async def count_pending_system_entries(
        self,
        subscription: UUID,
        price: UUID,
        *,
        organization_id: UUID,
        customer_id: UUID,
        cutoff: datetime,
    ) -> int:
        """
        Count the pending billing entries backed by a system event. These are the
        complement of the consumption events a `count` meter bills;
        `count_pending_entries` minus this yields the `source='user'` count without
        scanning every entry.

        Matching on all known system event names keeps this on the
        ix_events_org_source_name_customer_id_ingested_at index, pinning customer_id
        instead of scanning every system event in the org.
        """
        statement = (
            select(func.count())
            .select_from(BillingEntry)
            .join(Event, Event.id == BillingEntry.event_id)
            .where(
                *self._pending_entries_clauses(subscription, price, cutoff=cutoff),
                Event.organization_id == organization_id,
                Event.customer_id == customer_id,
                Event.source == EventSource.system,
                Event.name.in_(tuple(SystemEvent)),
            )
        )
        return await self.session.scalar(statement) or 0

    def get_by_pending_entries_for_meter_statement(
        self,
        subscription: UUID,
        meter: UUID,
        *,
        cutoff: datetime,
    ) -> Select[tuple[Event]]:
        """
        Get events for pending billing entries grouped by meter.
        Used for non-summable aggregations where we need to compute across all events
        in the period, regardless of which price was active when the event occurred.
        """
        statement = (
            self.get_base_statement()
            .join(BillingEntry, Event.id == BillingEntry.event_id)
            .join(
                ProductPrice,
                BillingEntry.product_price_id == ProductPrice.id,
            )
            .where(
                ProductPrice.is_metered,
                BillingEntry.subscription_id == subscription,
                BillingEntry.deleted_at.is_(None),
                BillingEntry.order_item_id.is_(None),
                # The subclass attribute would add a polymorphic filter and drop tiered prices.
                ProductPrice.__table__.c.meter_id == meter,
                BillingEntry.start_timestamp < cutoff,
                BillingEntry.created_at <= cutoff,
            )
            .order_by(Event.ingested_at.asc())
        )
        return statement

    def get_eager_options(self) -> Options:
        return (joinedload(Event.customer), joinedload(Event.event_types))

    async def get_meter_credit_by_external_id(
        self,
        organization_id: UUID,
        external_id: str,
        *,
        customer_id: UUID,
        metadata: Mapping[str, Any],
    ) -> Event | None:
        statement = self.get_base_statement().where(
            Event.organization_id == organization_id,
            Event.external_id == external_id,
            Event.is_meter_credit,
            Event.customer_id == customer_id,
            Event.user_metadata == metadata,
        )
        return await self.get_one_or_none(statement)

    async def get_reversible_meter_credit(
        self, id: UUID, org_ids: set[AccessibleOrganizationID]
    ) -> Event | None:
        statement = (
            self.get_base_statement()
            .where(
                Event.id == id,
                Event.organization_id.in_(org_ids),
                Event.is_meter_credit,
                Event.user_metadata["reason"].as_string() == "manual",
                Event.user_metadata["units"].as_integer() > 0,
            )
            .options(joinedload(Event.customer).joinedload(Customer.organization))
        )
        return await self.get_one_or_none(statement)

    async def get_meter_credit_reversal(self, credit: Event) -> Event | None:
        statement = (
            self.get_base_statement()
            .where(
                Event.organization_id == credit.organization_id,
                Event.customer_id == credit.customer_id,
                Event.is_meter_credit,
                Event.parent_id == credit.id,
            )
            .limit(1)
        )
        return await self.get_one_or_none(statement)

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
            .where(parent.c.parent_id.is_not(None), cte.c.depth < _MAX_RESOLVE_DEPTH)
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
