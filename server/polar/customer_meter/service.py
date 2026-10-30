import uuid
from collections.abc import Sequence
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

import logfire
from sqlalchemy import Float, Select, func, or_, select, union_all
from sqlalchemy.exc import DBAPIError, IntegrityError, MultipleResultsFound
from sqlalchemy.orm import joinedload
from sqlalchemy.orm.strategy_options import contains_eager

from polar.auth.models import AuthSubject, Organization, User
from polar.auth.permission import OrganizationPermission
from polar.authz.service import assert_organization_permission, get_accessible_org_ids
from polar.billing_entry.repository import BillingEntryRepository
from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.customer_session.service import AmbiguousExternalCustomerID
from polar.event.repository import EventRepository
from polar.event.service import event as event_service
from polar.event.system import (
    MeterCreditedMetadata,
    SystemEvent,
    build_system_event,
)
from polar.exceptions import PolarError, PolarRequestValidationError, ResourceNotFound
from polar.kit.db.locking import is_lock_not_available_error
from polar.kit.math import non_negative_running_sum
from polar.kit.metadata import get_nested_metadata_attr
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.kit.utils import utc_now
from polar.meter.aggregation import (
    AggregationFunction,
    PropertyAggregation,
    UniqueAggregation,
)
from polar.meter.repository import MeterRepository
from polar.models import Customer, CustomerMeter, Event, Meter
from polar.models.event import EventSource
from polar.postgres import AsyncSession
from polar.worker import enqueue_job

from .repository import CustomerMeterRepository
from .schemas import CustomerMeterCreditsCreate, CustomerMeterCreditsIDCreate
from .sorting import CustomerMeterSortProperty

_MAX_REVERSIBLE_DAYS = 7


class CustomerMeterCreditExternalIDConflict(PolarError):
    def __init__(self) -> None:
        super().__init__("This external_id is already used by a different event.", 409)


class CustomerMeterCreditNotReversible(PolarError):
    def __init__(self, message: str) -> None:
        super().__init__(message, 409)


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
        external_meter_id: Sequence[str] | None = None,
        pagination: PaginationParams,
        sorting: Sequence[Sorting[CustomerMeterSortProperty]] = (
            (CustomerMeterSortProperty.modified_at, True),
        ),
    ) -> tuple[Sequence[CustomerMeter], int]:
        repository = CustomerMeterRepository.from_session(session)
        org_ids = await get_accessible_org_ids(session, auth_subject)
        statement = (
            repository.get_statement_by_org_ids(org_ids)
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

        if external_meter_id is not None:
            statement = statement.where(Meter.external_id.in_(external_meter_id))

        if meter_id is None and external_meter_id is None:
            # Only filter archived meters when not querying for specific meters
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
        org_ids = await get_accessible_org_ids(session, auth_subject)
        statement = (
            repository.get_statement_by_org_ids(org_ids)
            .where(CustomerMeter.id == id)
            .options(joinedload(CustomerMeter.meter))
        )
        return await repository.get_one_or_none(statement)

    async def update_customer(self, session: AsyncSession, customer: Customer) -> None:
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
                session, customer, meter
            )
            updated = updated or meter_updated

        if updated:
            enqueue_job("customer.state_changed", customer.id)

    async def update_customer_meter(
        self,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
        activate_meter: bool = False,
    ) -> tuple[CustomerMeter | None, bool]:
        repository = CustomerMeterRepository.from_session(session)
        # Use FOR UPDATE NOWAIT to serialize access and ensure visibility of
        # concurrent changes. If lock can't be acquired, the task will be retried.
        try:
            customer_meter = await repository.get_by_customer_and_meter_for_update(
                customer.id, meter.id
            )
        except DBAPIError as e:
            if is_lock_not_available_error(e):
                logfire.warn(
                    "Could not obtain lock for customer meter update, will retry",
                    customer_id=str(customer.id),
                    meter_id=str(meter.id),
                )
            raise

        if customer_meter is not None and customer_meter.activated_at is None:
            if not activate_meter:
                return customer_meter, False
            customer_meter.activated_at = utc_now()

        # Optimization: only look for events ingested after the maximum debounce window
        # This avoids scanning all historical events
        # when checking if there are new events to process.
        ingested_at_lower_bound = (
            utc_now() - settings.CUSTOMER_METER_UPDATE_DEBOUNCE_MAX_THRESHOLD
        )

        with logfire.span("get_latest_event"):
            last_event = await self._get_latest_current_window_event(
                session, customer, meter, ingested_at_lower_bound
            )

        if customer_meter is None:
            activated_at = (
                utc_now() if (last_event is not None or activate_meter) else None
            )
            customer_meter = await repository.get_or_create(
                customer, meter, activated_at=activated_at
            )

        if last_event is None:
            return customer_meter, False

        if customer_meter.last_balanced_event_id == last_event.id:
            return customer_meter, False

        event_repository = EventRepository.from_session(session)

        with logfire.span("get_usage"):
            usage_units = await self._get_usage_quantity(session, customer, meter)

        customer_meter.consumed_units = Decimal(usage_units)

        with logfire.span("get_credits"):
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

    async def credit(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        credit_create: CustomerMeterCreditsCreate,
    ) -> Event:
        org_ids = await get_accessible_org_ids(session, auth_subject)

        customer_repository = CustomerRepository.from_session(session)
        options = (joinedload(Customer.organization),)
        if isinstance(credit_create, CustomerMeterCreditsIDCreate):
            customer_field = "customer_id"
            customer_value: uuid.UUID | str = credit_create.customer_id
            customer = await customer_repository.get_readable_by_id(
                org_ids, credit_create.customer_id, options=options
            )
        else:
            customer_field = "external_customer_id"
            customer_value = credit_create.external_customer_id
            try:
                customer = await customer_repository.get_readable_by_external_id(
                    org_ids, credit_create.external_customer_id, options=options
                )
            except MultipleResultsFound as e:
                raise AmbiguousExternalCustomerID(
                    credit_create.external_customer_id
                ) from e
        if customer is None:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", customer_field),
                        "msg": "Customer not found",
                        "input": customer_value,
                    }
                ]
            )

        meter_repository = MeterRepository.from_session(session)
        meter: Meter | None
        if isinstance(credit_create, CustomerMeterCreditsIDCreate):
            meter_field = "meter_id"
            meter_value: uuid.UUID | str = credit_create.meter_id
            meter = await meter_repository.get_readable_by_id(
                credit_create.meter_id, org_ids
            )
        else:
            meter_field = "external_meter_id"
            meter_value = credit_create.external_meter_id
            meters = await meter_repository.get_all_by_external_ids(
                customer.organization_id, [credit_create.external_meter_id]
            )
            meter = meters[0] if meters else None

        if (
            meter is None
            or meter.archived_at is not None
            or meter.organization_id != customer.organization_id
        ):
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", meter_field),
                        "msg": "Meter not found",
                        "input": meter_value,
                    }
                ]
            )

        await assert_organization_permission(
            session,
            auth_subject,
            customer.organization_id,
            OrganizationPermission.customers_manage,
        )

        metadata: MeterCreditedMetadata = {
            "meter_id": str(meter.id),
            "units": credit_create.units,
            "rollover": credit_create.rollover,
            "reason": "manual",
        }
        event = build_system_event(
            SystemEvent.meter_credited,
            customer=customer,
            organization=customer.organization,
            metadata=metadata,
        )
        event.external_id = credit_create.external_id
        event_repository = EventRepository.from_session(session)
        try:
            async with session.begin_nested():
                await event_service.create_event(session, event)
        except IntegrityError:
            if credit_create.external_id is None:
                raise
            existing_event = await event_repository.get_meter_credit_by_external_id(
                customer.organization_id,
                credit_create.external_id,
                customer_id=customer.id,
                metadata=metadata,
            )
            if existing_event is None:
                raise CustomerMeterCreditExternalIDConflict()
            event = existing_event

        try:
            async with session.begin_nested():
                _, updated = await self.update_customer_meter(
                    session, customer, meter, activate_meter=True
                )
            if updated:
                enqueue_job("customer.state_changed", customer.id)
        except DBAPIError as e:
            if not is_lock_not_available_error(e):
                raise
            # A worker is balancing this meter from a snapshot that predates the
            # credit, so schedule another pass once this transaction commits.
            enqueue_job("customer_meter.update_customer", customer.id)
            customer_meter_repository = CustomerMeterRepository.from_session(session)
            customer_meter = await customer_meter_repository.get_by_customer_and_meter(
                customer.id, meter.id
            )
            if customer_meter is not None and customer_meter.activated_at is None:
                await customer_meter_repository.update(
                    customer_meter, update_dict={"activated_at": utc_now()}
                )

        loaded = await event_repository.get_by_id_with_eager(event.id)
        assert loaded is not None
        return loaded

    async def reverse_credit(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> Event:
        org_ids = await get_accessible_org_ids(session, auth_subject)
        event_repository = EventRepository.from_session(session)
        credit = await event_repository.get_reversible_meter_credit(id, org_ids)
        if credit is None or credit.customer is None:
            raise ResourceNotFound()

        await assert_organization_permission(
            session,
            auth_subject,
            credit.organization_id,
            OrganizationPermission.customers_manage,
        )

        if credit.timestamp < utc_now() - timedelta(days=_MAX_REVERSIBLE_DAYS):
            raise CustomerMeterCreditNotReversible(
                f"Credits can only be reversed within {_MAX_REVERSIBLE_DAYS} days."
            )

        customer = credit.customer
        meter = await MeterRepository.from_session(session).get_by_id(
            uuid.UUID(credit.user_metadata["meter_id"])
        )
        if meter is None:
            raise ResourceNotFound()

        try:
            # Creates the row if missing, so concurrent reversals always have one to lock.
            await CustomerMeterRepository.from_session(session).get_or_create(
                customer, meter
            )
        except DBAPIError as e:
            if not is_lock_not_available_error(e):
                raise
            raise CustomerMeterCreditNotReversible(
                "This customer meter is being updated. Try again shortly."
            ) from e

        # Checked after locking the meter so a cycle committed concurrently is seen.
        meter_reset = await event_repository.get_latest_meter_reset(customer, meter.id)
        invoiced = await BillingEntryRepository.from_session(
            session
        ).has_invoiced_for_event(credit.id)
        if invoiced or (
            meter_reset is not None and credit.ingested_at < meter_reset.timestamp
        ):
            raise CustomerMeterCreditNotReversible(
                "Credits from a previous billing period can't be reversed."
            )

        if await event_repository.get_meter_credit_reversal(credit) is not None:
            raise CustomerMeterCreditNotReversible(
                "These credits have already been reversed."
            )

        # customer_meter.balance can be stale, it only refreshes when a recent event arrives.
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
        usage_units = Decimal(await self._get_usage_quantity(session, customer, meter))
        # Usage draws from non-rollover credits first, matching get_rollover_units.
        if credit.user_metadata["rollover"]:
            unused = min(
                Decimal(rollover_units),
                non_rollover_units + rollover_units - usage_units,
            )
        else:
            unused = non_rollover_units - usage_units
        units = min(credit.user_metadata["units"], max(int(unused), 0))
        if units == 0:
            raise CustomerMeterCreditNotReversible(
                "These credits have already been used."
            )

        event = build_system_event(
            SystemEvent.meter_credited,
            customer=customer,
            organization=customer.organization,
            metadata={
                "meter_id": str(meter.id),
                "units": -units,
                "rollover": credit.user_metadata["rollover"],
                "reason": "manual",
            },
        )
        event.parent_id = credit.id
        event.root_id = credit.root_id
        await event_service.create_event(session, event)

        _, updated = await self.update_customer_meter(
            session, customer, meter, activate_meter=True
        )
        if updated:
            enqueue_job("customer.state_changed", customer.id)

        loaded = await event_repository.get_by_id_with_eager(event.id)
        assert loaded is not None
        return loaded

    async def get_rollover_units(
        self,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
        *,
        cutoff: datetime | None = None,
    ) -> int:
        last_event = await self._get_latest_current_window_event(
            session, customer, meter, cutoff=cutoff
        )

        if last_event is None:
            return 0

        event_repository = EventRepository.from_session(session)

        usage_units = await self._get_usage_quantity(
            session, customer, meter, cutoff=cutoff
        )

        credit_events = await self._get_credit_events(
            customer, meter, event_repository, cutoff=cutoff
        )
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
        *,
        cutoff: datetime | None = None,
    ) -> Event | None:
        """
        Get the most recent event in the current meter window.
        """
        event_repository = EventRepository.from_session(session)
        meter_reset_event = await event_repository.get_latest_meter_reset(
            customer, meter.id, cutoff=cutoff
        )

        by_customer_id = self._build_latest_event_statement(
            event_repository,
            customer,
            meter,
            meter_reset_event,
            by_external_id=False,
            ingested_at_lower_bound=ingested_at_lower_bound,
            cutoff=cutoff,
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
            cutoff=cutoff,
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
            meter_reset_event_timestamp=(
                meter_reset_event.timestamp.isoformat() if meter_reset_event else None
            ),
            ingested_at_lower_bound=ingested_at_lower_bound,
        ):
            result = await session.execute(
                select(Event).from_statement(union_statement)
            )
            return result.scalar_one_or_none()

    def _build_events_statement(
        self,
        event_repository: EventRepository,
        customer: Customer,
        meter: Meter,
        meter_reset_event: Event | None,
        by_external_id: bool = False,
        cutoff: datetime | None = None,
        *,
        include_system_events: bool = True,
    ) -> Select[Event]:
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
            # A reset without an explicit timestamp is ingested a moment before its
            # own timestamp, and must still fall in its window.
            statement = statement.where(
                Event.ingested_at
                >= min(meter_reset_event.timestamp, meter_reset_event.ingested_at)
            )

        if cutoff is not None:
            statement = statement.where(Event.timestamp < cutoff)

        if by_external_id or not include_system_events:
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
        cutoff: datetime | None = None,
    ) -> Select[Event]:
        """Build a LIMIT 1 statement for getting the latest event."""
        statement = self._build_events_statement(
            event_repository,
            customer,
            meter,
            meter_reset_event,
            by_external_id,
            cutoff,
        )
        if ingested_at_lower_bound is not None:
            statement = statement.where(Event.ingested_at >= ingested_at_lower_bound)
        return statement.order_by(Event.ingested_at.desc()).limit(1)

    async def _get_usage_quantity(
        self,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
        *,
        cutoff: datetime | None = None,
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
            customer, meter.id, cutoff=cutoff
        )

        agg_column = func.coalesce(meter.aggregation.get_sql_column(Event), 0)

        by_customer_id = self._build_events_statement(
            event_repository,
            customer,
            meter,
            meter_reset_event,
            by_external_id=False,
            cutoff=cutoff,
            include_system_events=False,
        ).where(Event.source == EventSource.user)

        if customer.external_id is None:
            result = await session.scalar(
                by_customer_id.with_only_columns(agg_column, maintain_column_froms=True)
            )
            return result or 0.0

        by_external_id = self._build_events_statement(
            event_repository,
            customer,
            meter,
            meter_reset_event,
            by_external_id=True,
            cutoff=cutoff,
            include_system_events=False,
        ).where(Event.source == EventSource.user)

        if meter.aggregation.is_summable():
            union_subquery = union_all(
                by_customer_id.with_only_columns(
                    agg_column.label("value"), maintain_column_froms=True
                ),
                by_external_id.with_only_columns(
                    agg_column.label("value"), maintain_column_froms=True
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
            return get_nested_metadata_attr(Event, prop).as_float()
        elif isinstance(meter.aggregation, UniqueAggregation):
            return get_nested_metadata_attr(Event, meter.aggregation.property)
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
        *,
        cutoff: datetime | None = None,
    ) -> Sequence[Event]:
        """
        Get credit events for a customer's meter.

        System events (meter.credited, meter.reset) are always created with
        customer_id, never external_customer_id, so no UNION is needed.
        """
        meter_reset_event = await event_repository.get_latest_meter_reset(
            customer, meter.id, cutoff=cutoff
        )

        statement = (
            self._build_events_statement(
                event_repository,
                customer,
                meter,
                meter_reset_event,
                by_external_id=False,
                cutoff=cutoff,
            )
            .where(
                Event.is_meter_credit,
                Event.user_metadata["meter_id"].as_string() == str(meter.id),
            )
            .order_by(Event.timestamp.asc())
        )

        return await event_repository.get_all(statement)


customer_meter = CustomerMeterService()
