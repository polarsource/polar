import uuid
from collections.abc import Sequence
from datetime import datetime
from typing import Any

from sqlalchemy import (
    ColumnElement,
    ColumnExpressionArgument,
    UnaryExpression,
    and_,
    asc,
    desc,
    func,
    select,
)

from polar.auth.models import AuthSubject, Organization, User
from polar.billing_entry.repository import BillingEntryRepository
from polar.event.repository import EventRepository
from polar.kit.metadata import MetadataQuery, apply_metadata_clause
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.kit.time_queries import TimeInterval, get_timestamp_series_cte
from polar.models import BillingEntry, Event, Meter, SubscriptionProductPrice
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncSession
from polar.subscription.repository import SubscriptionProductPriceRepository
from polar.worker import enqueue_job

from .repository import MeterRepository
from .schemas import MeterCreate, MeterQuantities, MeterQuantity, MeterUpdate
from .sorting import MeterSortProperty


class MeterService:
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        metadata: MetadataQuery | None = None,
        query: str | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[MeterSortProperty]] = [
            (MeterSortProperty.meter_name, False)
        ],
    ) -> tuple[Sequence[Meter], int]:
        repository = MeterRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject)

        if organization_id is not None:
            statement = statement.where(Meter.organization_id.in_(organization_id))

        if query is not None:
            statement = statement.where(Meter.name.ilike(f"%{query}%"))

        if metadata is not None:
            statement = apply_metadata_clause(Meter, statement, metadata)

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == MeterSortProperty.created_at:
                order_by_clauses.append(clause_function(Meter.created_at))
            elif criterion == MeterSortProperty.meter_name:
                order_by_clauses.append(clause_function(Meter.name))
        statement = statement.order_by(*order_by_clauses)

        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> Meter | None:
        repository = MeterRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            Meter.id == id
        )
        return await repository.get_one_or_none(statement)

    async def create(
        self,
        session: AsyncSession,
        meter_create: MeterCreate,
        auth_subject: AuthSubject[User | Organization],
    ) -> Meter:
        repository = MeterRepository.from_session(session)
        organization = await get_payload_organization(
            session, auth_subject, meter_create
        )
        return await repository.create(
            Meter(
                **meter_create.model_dump(by_alias=True),
                organization=organization,
            )
        )

    async def update(
        self, session: AsyncSession, meter: Meter, meter_update: MeterUpdate
    ) -> Meter:
        repository = MeterRepository.from_session(session)
        return await repository.update(
            meter,
            update_dict=meter_update.model_dump(by_alias=True, exclude_unset=True),
        )

    async def events(
        self,
        session: AsyncSession,
        meter: Meter,
        *,
        pagination: PaginationParams,
    ) -> tuple[Sequence[Event], int]:
        repository = EventRepository.from_session(session)
        statement = repository.get_meter_statement(meter).order_by(
            Event.timestamp.desc()
        )
        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get_quantities(
        self,
        session: AsyncSession,
        meter: Meter,
        *,
        start_timestamp: datetime,
        end_timestamp: datetime,
        interval: TimeInterval,
        customer_id: Sequence[uuid.UUID] | None = None,
        external_customer_id: Sequence[str] | None = None,
    ) -> MeterQuantities:
        timestamp_series = get_timestamp_series_cte(
            start_timestamp, end_timestamp, interval
        )
        timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp

        event_clauses: list[ColumnExpressionArgument[bool]] = [
            Event.organization_id == meter.organization_id,
            interval.sql_date_trunc(Event.timestamp)
            == interval.sql_date_trunc(timestamp_column),
        ]
        event_repository = EventRepository.from_session(session)
        if customer_id is not None:
            event_clauses.append(
                event_repository.get_customer_id_filter_clause(customer_id)
            )
        if external_customer_id is not None:
            event_clauses.append(
                event_repository.get_external_customer_id_filter_clause(
                    external_customer_id
                )
            )
        event_clauses += [
            meter.filter.get_sql_clause(Event),
            # Additional clauses to make sure we work on rows with the right type for aggregation
            meter.aggregation.get_sql_clause(Event),
        ]

        statement = (
            select(
                timestamp_column.label("timestamp"),
                func.coalesce(meter.aggregation.get_sql_column(Event), 0),
            )
            .join(Event, onclause=and_(*event_clauses), isouter=True)
            .group_by(timestamp_column)
            .order_by(timestamp_column.asc())
        )

        result = await session.stream(statement)
        return MeterQuantities(
            quantities=[
                MeterQuantity(timestamp=row.timestamp, quantity=row[1])
                async for row in result
            ]
        )

    async def enqueue_billing(self, session: AsyncSession) -> None:
        repository = MeterRepository.from_session(session)
        statement = repository.get_base_statement().order_by(Meter.created_at.asc())
        async for meter in repository.stream(statement):
            enqueue_job("meter.billing_entries", meter.id)

    async def create_billing_entries(
        self, session: AsyncSession, meter: Meter
    ) -> Sequence[BillingEntry]:
        event_repository = EventRepository.from_session(session)
        statement = (
            event_repository.get_meter_statement(meter)
            .where(Event.customer.is_not(None))
            .order_by(Event.timestamp.asc())
        )
        last_billed_event = meter.last_billed_event
        if last_billed_event is not None:
            statement = statement.where(Event.timestamp > last_billed_event.timestamp)
        events = await event_repository.get_all(statement)

        subscription_product_price_repository = (
            SubscriptionProductPriceRepository.from_session(session)
        )
        customer_price_map: dict[uuid.UUID, SubscriptionProductPrice | None] = {}

        billing_entry_repository = BillingEntryRepository.from_session(session)
        entries: list[BillingEntry] = []
        for event in events:
            customer = event.customer
            assert customer is not None

            # Retrieve an active price for the customer and meter
            try:
                subscription_product_price = customer_price_map[customer.id]
            except KeyError:
                subscription_product_price = await subscription_product_price_repository.get_by_customer_and_meter(
                    customer.id, meter.id
                )
                customer_price_map[customer.id] = subscription_product_price
            if subscription_product_price is None:
                continue

            # Create a billing entry
            entries.append(
                await billing_entry_repository.create(
                    BillingEntry.from_metered_event(
                        customer, subscription_product_price, event
                    )
                )
            )

        # Update the last billed event
        meter.last_billed_event = events[-1] if events else last_billed_event
        session.add(meter)

        return entries

    async def get_quantity(
        self, session: AsyncSession, meter: Meter, events: Sequence[uuid.UUID]
    ) -> float:
        statement = select(
            func.coalesce(meter.aggregation.get_sql_column(Event), 0)
        ).where(Event.id.in_(events))
        result = await session.scalar(statement)
        return result or 0.0


meter = MeterService()
