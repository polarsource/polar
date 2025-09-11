import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    ColumnElement,
    ColumnExpressionArgument,
    Select,
    UnaryExpression,
    and_,
    asc,
    desc,
    func,
    or_,
    select,
)
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject, Organization, User
from polar.billing_entry.repository import BillingEntryRepository
from polar.event.repository import EventRepository
from polar.exceptions import PolarError, PolarRequestValidationError, ValidationError
from polar.kit.metadata import MetadataQuery, apply_metadata_clause, get_metadata_clause
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.kit.time_queries import TimeInterval, get_timestamp_series_cte
from polar.models import (
    Benefit,
    BillingEntry,
    Event,
    Meter,
    Product,
    ProductPriceMeteredUnit,
    SubscriptionProductPrice,
)
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncReadSession, AsyncSession
from polar.subscription.repository import SubscriptionProductPriceRepository
from polar.worker import enqueue_job

from .repository import MeterRepository
from .schemas import MeterCreate, MeterQuantities, MeterQuantity, MeterUpdate
from .sorting import MeterSortProperty


class MeterError(PolarError): ...


class MeterService:
    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        metadata: MetadataQuery | None = None,
        query: str | None = None,
        is_archived: bool | None = None,
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

        if is_archived is not None:
            if is_archived:
                statement = statement.where(Meter.archived_at.is_not(None))
            else:
                statement = statement.where(Meter.archived_at.is_(None))

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
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> Meter | None:
        repository = MeterRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .where(Meter.id == id)
            .options(joinedload(Meter.last_billed_event))
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

        meter = await repository.create(
            Meter(
                **meter_create.model_dump(
                    by_alias=True, exclude={"filter", "aggregation"}
                ),
                filter=meter_create.filter,
                aggregation=meter_create.aggregation,
                organization=organization,
            ),
            flush=True,
        )

        # Retrieve the latest matching event for the meter and set it as the last billed event
        # This is done to ensure that the meter is billed from the last event onwards
        event_repository = EventRepository.from_session(session)
        statement = (
            event_repository.get_meter_statement(meter)
            .order_by(Event.timestamp.desc())
            .limit(1)
        )
        last_billed_event = await event_repository.get_one_or_none(statement)
        await repository.update(
            meter, update_dict={"last_billed_event": last_billed_event}
        )

        return meter

    async def update(
        self, session: AsyncSession, meter: Meter, meter_update: MeterUpdate
    ) -> Meter:
        repository = MeterRepository.from_session(session)

        errors: list[ValidationError] = []
        if meter.last_billed_event is not None:
            sensitive_fields = {"filter", "aggregation"}
            for sensitive_field in sensitive_fields:
                if sensitive_field in meter_update.model_fields_set:
                    errors.append(
                        {
                            "type": "forbidden",
                            "loc": ("body", sensitive_field),
                            "msg": (
                                "This field can't be updated because the meter "
                                "is already aggregating events."
                            ),
                            "input": getattr(meter_update, sensitive_field),
                        }
                    )

        if errors:
            raise PolarRequestValidationError(errors)

        update_dict = meter_update.model_dump(
            by_alias=True,
            exclude_unset=True,
            exclude={"filter", "aggregation", "is_archived"},
        )
        if meter_update.filter is not None:
            update_dict["filter"] = meter_update.filter
        if meter_update.aggregation is not None:
            update_dict["aggregation"] = meter_update.aggregation

        # Handle archiving/unarchiving
        if meter_update.is_archived is not None:
            if meter_update.is_archived:
                meter = await self.archive(session, meter)
            else:
                meter = await self.unarchive(session, meter)

        return await repository.update(meter, update_dict=update_dict)

    async def archive(self, session: AsyncSession, meter: Meter) -> Meter:
        # Check if meter is attached to any active ProductPriceMeteredUnit
        active_prices = await session.scalar(
            select(func.count(ProductPriceMeteredUnit.id))
            .join(Product)
            .where(
                Product.is_archived.is_(False),
                ProductPriceMeteredUnit.meter_id == meter.id,
                ProductPriceMeteredUnit.is_archived.is_(False),
                ProductPriceMeteredUnit.deleted_at.is_(None),
            )
        )

        if active_prices and active_prices > 0:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "is_archived"),
                        "msg": "Cannot archive meter that is still attached to active products",
                        "input": True,
                    }
                ]
            )

        # Check if meter is referenced by any active Benefits with meter_credit type
        active_benefits = await session.scalar(
            select(func.count(Benefit.id)).where(
                Benefit.type == "meter_credit",
                Benefit.properties["meter_id"].as_string() == str(meter.id),
                Benefit.deleted_at.is_(None),
            )
        )

        if active_benefits and active_benefits > 0:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "is_archived"),
                        "msg": "Cannot archive meter that is still referenced by active benefits",
                        "input": True,
                    }
                ]
            )

        repository = MeterRepository.from_session(session)
        return await repository.update(
            meter, update_dict={"archived_at": datetime.now(UTC)}
        )

    async def unarchive(self, session: AsyncSession, meter: Meter) -> Meter:
        repository = MeterRepository.from_session(session)
        return await repository.update(meter, update_dict={"archived_at": None})

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
        session: AsyncReadSession,
        meter: Meter,
        *,
        start_timestamp: datetime,
        end_timestamp: datetime,
        interval: TimeInterval,
        customer_id: Sequence[uuid.UUID] | None = None,
        external_customer_id: Sequence[str] | None = None,
        metadata: MetadataQuery | None = None,
    ) -> MeterQuantities:
        timestamp_series = get_timestamp_series_cte(
            start_timestamp, end_timestamp, interval
        )
        timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp

        event_clauses: list[ColumnExpressionArgument[bool]] = [
            Event.organization_id == meter.organization_id,
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
        if metadata is not None:
            event_clauses.append(get_metadata_clause(Event, metadata))
        event_clauses.append(event_repository.get_meter_clause(meter))

        statement = (
            select(
                timestamp_column.label("timestamp"),
                func.coalesce(
                    meter.aggregation.get_sql_column(Event).filter(
                        interval.sql_date_trunc(Event.timestamp)
                        == interval.sql_date_trunc(timestamp_column),
                    ),
                    0,
                ),
                func.coalesce(
                    meter.aggregation.get_sql_column(Event).filter(
                        interval.sql_date_trunc(Event.timestamp)
                        >= interval.sql_date_trunc(start_timestamp),
                        interval.sql_date_trunc(Event.timestamp)
                        <= interval.sql_date_trunc(end_timestamp),
                    ),
                    0,
                ),
            )
            .join(Event, onclause=and_(*event_clauses), isouter=True)
            .group_by(timestamp_column)
            .order_by(timestamp_column.asc())
        )

        total = 0.0
        quantities: list[MeterQuantity] = []
        result = await session.stream(statement)
        async for row in result:
            quantities.append(MeterQuantity(timestamp=row.timestamp, quantity=row[1]))
            total = row[2]

        return MeterQuantities(quantities=quantities, total=total)

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
            event_repository.get_base_statement()
            .where(
                Event.organization_id == meter.organization_id,
                Event.customer.is_not(None),
                or_(
                    # Events matching meter definitions
                    event_repository.get_meter_clause(meter),
                    # System events impacting the meter balance
                    event_repository.get_meter_system_clause(meter),
                ),
            )
            .order_by(Event.ingested_at.asc())
            .options(*event_repository.get_eager_options())
        )
        last_billed_event = meter.last_billed_event
        if last_billed_event is not None:
            statement = statement.where(
                Event.ingested_at > last_billed_event.ingested_at
            )

        subscription_product_price_repository = (
            SubscriptionProductPriceRepository.from_session(session)
        )
        customer_price_map: dict[uuid.UUID, SubscriptionProductPrice | None] = {}

        billing_entry_repository = BillingEntryRepository.from_session(session)
        entries: list[BillingEntry] = []
        updated_subscriptions: set[uuid.UUID] = set()
        last_event: Event | None = None
        async for event in event_repository.stream(statement):
            last_event = event
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
            entry = await billing_entry_repository.create(
                BillingEntry.from_metered_event(
                    customer, subscription_product_price, event
                )
            )
            entries.append(entry)
            if entry.subscription is not None:
                updated_subscriptions.add(entry.subscription.id)

        # Update the last billed event
        meter.last_billed_event = (
            last_event if last_event is not None else last_billed_event
        )
        session.add(meter)

        # Update subscription meters
        for subscription_id in updated_subscriptions:
            enqueue_job("subscription.update_meters", subscription_id)

        return entries

    async def get_quantity(
        self,
        session: AsyncSession,
        meter: Meter,
        events_statement: Select[tuple[uuid.UUID]],
    ) -> float:
        statement = select(
            func.coalesce(meter.aggregation.get_sql_column(Event), 0)
        ).where(Event.id.in_(events_statement))
        result = await session.scalar(statement)
        return result or 0.0


meter = MeterService()
