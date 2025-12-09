import uuid
from collections.abc import Sequence
from decimal import Decimal

from sqlalchemy import Select, any_, cast, or_, select, union_all
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import joinedload
from sqlalchemy.orm.strategy_options import contains_eager

from polar.auth.models import AuthSubject, Organization, User
from polar.customer.repository import CustomerRepository
from polar.event.repository import EventRepository
from polar.kit.math import non_negative_running_sum
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.locker import Locker
from polar.meter.repository import MeterRepository
from polar.meter.service import meter as meter_service
from polar.models import Customer, CustomerMeter, Event, Meter
from polar.models.event import EventSource
from polar.models.webhook_endpoint import WebhookEventType
from polar.postgres import AsyncSession
from polar.worker import enqueue_job

from .repository import CustomerMeterRepository
from .sorting import CustomerMeterSortProperty


class CustomerMeterService:
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        customer_id: Sequence[uuid.UUID] | None = None,
        external_customer_id: Sequence[str] | None = None,
        meter_id: Sequence[uuid.UUID] | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[CustomerMeterSortProperty]] = [
            (CustomerMeterSortProperty.modified_at, True)
        ],
    ) -> tuple[Sequence[CustomerMeter], int]:
        repository = CustomerMeterRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .join(CustomerMeter.meter)
            .options(contains_eager(CustomerMeter.meter))
        )

        if organization_id is not None:
            statement = statement.where(Customer.organization_id.in_(organization_id))

        if customer_id is not None:
            statement = statement.where(Customer.id.in_(customer_id))

        if external_customer_id is not None:
            statement = statement.where(Customer.external_id.in_(external_customer_id))

        if meter_id is not None:
            statement = statement.where(Meter.id.in_(meter_id))
        else:
            # Only filter archived meters when not querying for specific meter IDs
            statement = statement.where(Meter.archived_at.is_(None))

        statement = repository.apply_sorting(statement, sorting)

        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> CustomerMeter | None:
        repository = CustomerMeterRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .where(CustomerMeter.id == id)
            .options(joinedload(CustomerMeter.meter))
        )
        return await repository.get_one_or_none(statement)

    async def update_customer(
        self, session: AsyncSession, locker: Locker, customer: Customer
    ) -> None:
        repository = MeterRepository.from_session(session)
        statement = (
            repository.get_base_statement()
            .where(Meter.organization_id == customer.organization_id)
            .order_by(Meter.created_at.asc())
        )

        updated = False
        async for meter in repository.stream(statement):
            _, meter_updated = await self.update_customer_meter(
                session, locker, customer, meter
            )
            updated = updated or meter_updated

        if updated:
            enqueue_job(
                "customer.webhook", WebhookEventType.customer_state_changed, customer.id
            )

        customer_repository = CustomerRepository.from_session(session)
        await customer_repository.set_meters_updated_at((customer,))

    async def update_customer_meter(
        self, session: AsyncSession, locker: Locker, customer: Customer, meter: Meter
    ) -> tuple[CustomerMeter | None, bool]:
        async with locker.lock(
            f"customer_meter:{customer.id}:{meter.id}",
            timeout=5.0,
            blocking_timeout=0.2,
        ):
            repository = CustomerMeterRepository.from_session(session)
            customer_meter = await repository.get_by_customer_and_meter(
                customer.id, meter.id
            )

            last_event = await self._get_latest_current_window_event(
                session, customer, meter
            )

            if last_event is None:
                return customer_meter, False

            if customer_meter is None:
                customer_meter = await repository.create(
                    CustomerMeter(customer=customer, meter=meter)
                )

            if customer_meter.last_balanced_event_id == last_event.id:
                return customer_meter, False

            # Get chainable statement for filtering
            event_repository = EventRepository.from_session(session)
            events_statement = await self._get_current_window_events_statement(
                session, customer, meter
            )

            usage_events_statement = events_statement.where(
                Event.source == EventSource.user
            )
            usage_units = await meter_service.get_quantity(
                session, meter, usage_events_statement
            )
            customer_meter.consumed_units = Decimal(usage_units)

            credit_events_statement = events_statement.where(
                Event.is_meter_credit.is_(True)
            )
            credit_events = await event_repository.get_all(credit_events_statement)
            credited_units = non_negative_running_sum(
                event.user_metadata["units"] for event in credit_events
            )
            customer_meter.credited_units = credited_units
            customer_meter.balance = (
                customer_meter.credited_units - customer_meter.consumed_units
            )
            customer_meter.last_balanced_event = last_event

            return await repository.update(customer_meter), True

    async def get_rollover_units(
        self, session: AsyncSession, customer: Customer, meter: Meter
    ) -> int:
        last_event = await self._get_latest_current_window_event(
            session, customer, meter
        )

        if last_event is None:
            return 0

        # Get chainable statement for filtering
        event_repository = EventRepository.from_session(session)
        events_statement = await self._get_current_window_events_statement(
            session, customer, meter
        )

        usage_events_statement = events_statement.where(
            Event.source == EventSource.user
        )
        usage_units = await meter_service.get_quantity(
            session, meter, usage_events_statement
        )

        credit_events_statement = events_statement.where(
            Event.is_meter_credit.is_(True)
        )
        credit_events = await event_repository.get_all(credit_events_statement)
        non_rollover_units = non_negative_running_sum(
            event.user_metadata["units"]
            for event in credit_events
            if not event.user_metadata["rollover"]
        )
        rollover_units = non_negative_running_sum(
            event.user_metadata["units"]
            for event in credit_events
            if event.user_metadata["rollover"]
        )
        balance = non_rollover_units + rollover_units - usage_units

        return max(0, min(int(balance), rollover_units))

    async def _get_latest_current_window_event(
        self, session: AsyncSession, customer: Customer, meter: Meter
    ) -> Event | None:
        """
        Get the most recent event in the current meter window.
        """
        event_repository = EventRepository.from_session(session)
        meter_reset_event = await event_repository.get_latest_meter_reset(
            customer, meter.id
        )

        by_customer_id = self._build_latest_event_statement(
            event_repository, customer, meter, meter_reset_event, by_external_id=False
        )

        # No union required when no external_id
        if customer.external_id is None:
            return await event_repository.get_one_or_none(by_customer_id)

        # Union optimization: query by customer_id and external_id separately,
        # then merge results. This avoids slow BitmapOr scans that Postgres
        # uses for OR clauses on different indexed columns.
        by_external_id = self._build_latest_event_statement(
            event_repository, customer, meter, meter_reset_event, by_external_id=True
        )
        union_statement = union_all(by_customer_id, by_external_id)
        union_statement = union_statement.order_by(Event.ingested_at.desc()).limit(1)

        # Execute directly - FromStatement works fine for execution
        result = await session.execute(select(Event).from_statement(union_statement))
        return result.scalar_one_or_none()

    async def _get_current_window_events_statement(
        self, session: AsyncSession, customer: Customer, meter: Meter
    ) -> Select[tuple[Event]]:
        """
        Get a chainable statement for all events in the current meter window.

        Uses UNION optimization to get event IDs, then returns a Select
        that filters by those IDs. This avoids slow BitmapOr scans while
        returning a proper Select that supports .where() chaining.
        """
        event_ids = await self._get_current_window_event_ids(session, customer, meter)

        if not event_ids:
            # Return empty result
            return select(Event).where(Event.id.in_([]))

        event_repository = EventRepository.from_session(session)
        # Use ANY with array to avoid 32k parameter limit
        return event_repository.get_base_statement().where(
            Event.id == any_(cast(list(event_ids), ARRAY(PgUUID)))
        )

    async def _get_current_window_event_ids(
        self, session: AsyncSession, customer: Customer, meter: Meter
    ) -> Sequence[uuid.UUID]:
        """Get IDs of all events in the current window using UNION optimization."""
        event_repository = EventRepository.from_session(session)
        meter_reset_event = await event_repository.get_latest_meter_reset(
            customer, meter.id
        )

        by_customer_id = self._build_events_statement(
            event_repository, customer, meter, meter_reset_event, by_external_id=False
        )

        if customer.external_id is None:
            result = await session.execute(by_customer_id.with_only_columns(Event.id))
            return [row[0] for row in result.all()]

        by_external_id = self._build_events_statement(
            event_repository, customer, meter, meter_reset_event, by_external_id=True
        )

        # UNION to avoid BitmapOr
        union_statement = union_all(
            by_customer_id.with_only_columns(Event.id),
            by_external_id.with_only_columns(Event.id),
        )

        result = await session.execute(union_statement)
        return list(set(row[0] for row in result.all()))  # Dedupe

    def _build_events_statement(
        self,
        event_repository: EventRepository,
        customer: Customer,
        meter: Meter,
        meter_reset_event: Event | None,
        by_external_id: bool = False,
    ) -> Select[tuple[Event]]:
        """Build statement for events by customer_id or external_id (no LIMIT)."""
        statement = event_repository.get_base_statement().where(
            Event.organization_id == meter.organization_id,
        )

        if by_external_id:
            statement = statement.where(
                Event.external_customer_id == customer.external_id
            )
        else:
            statement = statement.where(Event.customer_id == customer.id)

        if meter_reset_event is not None:
            statement = statement.where(
                Event.ingested_at >= meter_reset_event.ingested_at
            )

        statement = statement.where(
            or_(
                event_repository.get_meter_clause(meter),
                event_repository.get_meter_system_clause(meter),
            ),
        )

        return statement

    def _build_latest_event_statement(
        self,
        event_repository: EventRepository,
        customer: Customer,
        meter: Meter,
        meter_reset_event: Event | None,
        by_external_id: bool = False,
    ) -> Select[tuple[Event]]:
        """Build a LIMIT 1 statement for getting the latest event."""
        return (
            self._build_events_statement(
                event_repository, customer, meter, meter_reset_event, by_external_id
            )
            .order_by(Event.ingested_at.desc())
            .limit(1)
        )


customer_meter = CustomerMeterService()
