import uuid
from collections.abc import Sequence
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

import logfire
from sqlalchemy import Float, Select, func, or_, select, union_all
from sqlalchemy.orm import joinedload
from sqlalchemy.orm.strategy_options import contains_eager

from polar.auth.models import AuthSubject, Organization, User
from polar.customer.repository import CustomerRepository
from polar.event.repository import EventRepository
from polar.kit.math import non_negative_running_sum
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.kit.utils import utc_now
from polar.locker import Locker
from polar.meter.aggregation import (
    AggregationFunction,
    PropertyAggregation,
    UniqueAggregation,
)
from polar.meter.repository import MeterRepository
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
        self,
        session: AsyncSession,
        locker: Locker,
        customer: Customer,
        meters_dirtied_at: datetime | None = None,
    ) -> None:
        repository = MeterRepository.from_session(session)
        statement = (
            repository.get_base_statement()
            .where(
                Meter.organization_id == customer.organization_id,
                Meter.archived_at.is_(None),
            )
            .order_by(Meter.created_at.asc())
        )

        updated = False
        async for meter in repository.stream(statement):
            _, meter_updated = await self.update_customer_meter(
                session, locker, customer, meter, meters_dirtied_at=meters_dirtied_at
            )
            updated = updated or meter_updated

        if updated:
            enqueue_job(
                "customer.webhook", WebhookEventType.customer_state_changed, customer.id
            )

        customer_repository = CustomerRepository.from_session(session)
        await customer_repository.set_meters_updated_at((customer,))

    async def update_customer_meter(
        self,
        session: AsyncSession,
        locker: Locker,
        customer: Customer,
        meter: Meter,
        activate_meter: bool = False,
        meters_dirtied_at: datetime | None = None,
    ) -> tuple[CustomerMeter | None, bool]:
        async with locker.lock(
            f"customer_meter:{customer.id}:{meter.id}",
            timeout=30.0,
            blocking_timeout=0.2,
        ):
            repository = CustomerMeterRepository.from_session(session)
            customer_meter = await repository.get_by_customer_and_meter(
                customer.id, meter.id
            )

            if customer_meter is not None and customer_meter.activated_at is None:
                if not activate_meter:
                    return customer_meter, False
                customer_meter.activated_at = utc_now()

            # Optimization: only look for events ingested after meters_dirtied_at
            # minus a small buffer. This avoids scanning all historical events
            # when checking if there are new events to process.
            ingested_at_lower_bound: datetime | None = None
            if meters_dirtied_at is not None:
                ingested_at_lower_bound = meters_dirtied_at - timedelta(minutes=1)

            last_event = await self._get_latest_current_window_event(
                session, customer, meter, ingested_at_lower_bound
            )

            if customer_meter is None:
                activated_at = (
                    utc_now() if (last_event is not None or activate_meter) else None
                )
                customer_meter = await repository.create(
                    CustomerMeter(
                        customer=customer, meter=meter, activated_at=activated_at
                    )
                )

            if last_event is None:
                return customer_meter, False

            if customer_meter.last_balanced_event_id == last_event.id:
                return customer_meter, False

            event_repository = EventRepository.from_session(session)

            usage_units = await self._get_usage_quantity(session, customer, meter)
            customer_meter.consumed_units = Decimal(usage_units)

            credit_events = await self._get_credit_events(
                customer, meter, event_repository
            )
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

        event_repository = EventRepository.from_session(session)

        usage_units = await self._get_usage_quantity(session, customer, meter)

        credit_events = await self._get_credit_events(customer, meter, event_repository)
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
        self,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
        ingested_at_lower_bound: datetime | None = None,
    ) -> Event | None:
        """
        Get the most recent event in the current meter window.
        """
        event_repository = EventRepository.from_session(session)
        meter_reset_event = await event_repository.get_latest_meter_reset(
            customer, meter.id
        )

        by_customer_id = self._build_latest_event_statement(
            event_repository,
            customer,
            meter,
            meter_reset_event,
            by_external_id=False,
            ingested_at_lower_bound=ingested_at_lower_bound,
        )

        # No union required when no external_id
        if customer.external_id is None:
            return await event_repository.get_one_or_none(by_customer_id)

        # Union optimization: query by customer_id and external_id separately,
        # then merge results. This avoids slow BitmapOr scans that Postgres
        # uses for OR clauses on different indexed columns.
        by_external_id = self._build_latest_event_statement(
            event_repository,
            customer,
            meter,
            meter_reset_event,
            by_external_id=True,
            ingested_at_lower_bound=ingested_at_lower_bound,
        )
        union_statement = union_all(by_customer_id, by_external_id)
        union_statement = union_statement.order_by(Event.ingested_at.desc()).limit(1)

        with logfire.span(
            "Get latest current window event",
            organization_id=str(meter.organization_id),
            customer_id=str(customer.id),
            external_customer_id=customer.external_id,
            meter_id=str(meter.id),
            meter_filter=meter.filter.model_dump_json() if meter.filter else None,
            meter_reset_event_ingested_at=(
                meter_reset_event.ingested_at.isoformat() if meter_reset_event else None
            ),
            ingested_at_lower_bound=ingested_at_lower_bound,
        ):
            result = await session.execute(
                select(Event).from_statement(union_statement)
            )
            return result.scalar_one_or_none()

    async def _get_current_window_events_statement(
        self, session: AsyncSession, customer: Customer, meter: Meter
    ) -> Select[tuple[Event]]:
        """
        Get a chainable statement for all events in the current meter window.

        Uses a subquery with UNION optimization to filter events. This avoids:
        1. Slow BitmapOr scans from OR clauses on different indexed columns
        2. Round-trips to fetch IDs into Python then back to PostgreSQL
        3. The 32k parameter limit in asyncpg


        Events are ordered by timestamp to ensure correct ordering for running
        sum calculations (e.g., non_negative_running_sum for credits).
        """
        event_repository = EventRepository.from_session(session)
        meter_reset_event = await event_repository.get_latest_meter_reset(
            customer, meter.id
        )

        by_customer_id = self._build_events_statement(
            event_repository, customer, meter, meter_reset_event, by_external_id=False
        )

        if customer.external_id is None:
            return by_customer_id.order_by(Event.timestamp.asc())

        by_external_id = self._build_events_statement(
            event_repository, customer, meter, meter_reset_event, by_external_id=True
        )

        # UNION to avoid BitmapOr
        event_ids_subquery = union_all(
            by_customer_id.with_only_columns(Event.id),
            by_external_id.with_only_columns(Event.id),
        ).subquery()

        return (
            event_repository.get_base_statement()
            .where(Event.id.in_(select(event_ids_subquery.c.id)))
            .order_by(Event.timestamp.asc())
        )

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

        if by_external_id:
            statement = statement.where(event_repository.get_meter_clause(meter))
        else:
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
        ingested_at_lower_bound: datetime | None = None,
    ) -> Select[tuple[Event]]:
        """Build a LIMIT 1 statement for getting the latest event."""
        statement = self._build_events_statement(
            event_repository, customer, meter, meter_reset_event, by_external_id
        )
        if ingested_at_lower_bound is not None:
            statement = statement.where(Event.ingested_at >= ingested_at_lower_bound)
        return statement.order_by(Event.ingested_at.desc()).limit(1)

    async def _get_usage_quantity(
        self, session: AsyncSession, customer: Customer, meter: Meter
    ) -> float:
        """
        Get the aggregated usage quantity for a customer's meter.

        This method avoids the expensive nested loop that occurs when fetching
        IDs first and then re-querying to aggregate. For summable aggregations
        (COUNT, SUM), we aggregate each branch and sum the results. For
        non-summable aggregations (MAX, MIN, AVG, UNIQUE), we aggregate over
        the raw values from the union.
        """
        event_repository = EventRepository.from_session(session)
        meter_reset_event = await event_repository.get_latest_meter_reset(
            customer, meter.id
        )

        agg_column = func.coalesce(meter.aggregation.get_sql_column(Event), 0)

        by_customer_id = self._build_events_statement(
            event_repository, customer, meter, meter_reset_event, by_external_id=False
        ).where(Event.source == EventSource.user)

        if customer.external_id is None:
            result = await session.scalar(by_customer_id.with_only_columns(agg_column))
            return result or 0.0

        by_external_id = self._build_events_statement(
            event_repository, customer, meter, meter_reset_event, by_external_id=True
        ).where(Event.source == EventSource.user)

        if meter.aggregation.is_summable():
            union_subquery = union_all(
                by_customer_id.with_only_columns(
                    meter.aggregation.get_sql_column(Event).label("value")
                ),
                by_external_id.with_only_columns(
                    meter.aggregation.get_sql_column(Event).label("value")
                ),
            ).subquery()

            result = await session.scalar(
                select(func.coalesce(func.sum(union_subquery.c.value), 0))
            )
            return result or 0.0

        raw_value_column = self._get_raw_aggregation_column(meter)
        union_subquery = union_all(
            by_customer_id.with_only_columns(raw_value_column.label("value")),
            by_external_id.with_only_columns(raw_value_column.label("value")),
        ).subquery()

        outer_agg = self._get_outer_aggregation(meter, union_subquery.c.value)
        result = await session.scalar(select(func.coalesce(outer_agg, 0)))
        return result or 0.0

    def _get_raw_aggregation_column(self, meter: Meter) -> Any:
        if isinstance(meter.aggregation, PropertyAggregation):
            prop = meter.aggregation.property
            if prop in Event._filterable_fields:
                _, attr = Event._filterable_fields[prop]
                return func.cast(attr, Float)
            return Event.user_metadata[prop].as_float()
        elif isinstance(meter.aggregation, UniqueAggregation):
            return Event.user_metadata[meter.aggregation.property]
        return Event.id

    def _get_outer_aggregation(self, meter: Meter, column: Any) -> Any:
        if isinstance(meter.aggregation, PropertyAggregation):
            match meter.aggregation.func:
                case AggregationFunction.max:
                    return func.max(column)
                case AggregationFunction.min:
                    return func.min(column)
                case AggregationFunction.avg:
                    return func.avg(column)
        elif isinstance(meter.aggregation, UniqueAggregation):
            return func.count(func.distinct(column))
        return func.sum(column)

    async def _get_credit_events(
        self,
        customer: Customer,
        meter: Meter,
        event_repository: EventRepository,
    ) -> Sequence[Event]:
        """
        Get credit events for a customer's meter.

        System events (meter.credited, meter.reset) are always created with
        customer_id, never external_customer_id, so no UNION is needed.
        """
        meter_reset_event = await event_repository.get_latest_meter_reset(
            customer, meter.id
        )

        statement = (
            self._build_events_statement(
                event_repository,
                customer,
                meter,
                meter_reset_event,
                by_external_id=False,
            )
            .where(Event.is_meter_credit.is_(True))
            .order_by(Event.timestamp.asc())
        )

        return await event_repository.get_all(statement)


customer_meter = CustomerMeterService()
