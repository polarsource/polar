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
from polar.kit.metadata import MetadataQuery, apply_metadata_clause
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.kit.time_queries import TimeInterval, get_timestamp_series_cte
from polar.models import Event, Meter
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncSession

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
            interval.sql_date_trunc(Event.timestamp)
            == interval.sql_date_trunc(timestamp_column),
        ]
        if customer_id is not None:
            event_clauses.append(Event.customer_id.in_(customer_id))
        if external_customer_id is not None:
            event_clauses.append(Event.external_customer_id.in_(external_customer_id))
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


meter = MeterService()
