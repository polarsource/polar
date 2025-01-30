import uuid
from collections.abc import Sequence
from datetime import datetime
from decimal import Decimal

from sqlalchemy import ColumnElement, ColumnExpressionArgument, and_, func, select

from polar.kit.time_queries import TimeInterval, get_timestamp_series_cte
from polar.models import Event, Meter
from polar.postgres import AsyncSession


class MeterService:
    async def get_values(
        self,
        session: AsyncSession,
        meter: Meter,
        *,
        start_timestamp: datetime,
        end_timestamp: datetime,
        interval: TimeInterval,
        customer_id: uuid.UUID | None = None,
        external_customer_id: str | None = None,
    ) -> Sequence[tuple[datetime, Decimal]]:
        timestamp_series = get_timestamp_series_cte(
            start_timestamp, end_timestamp, interval
        )
        timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp

        event_clauses: list[ColumnExpressionArgument[bool]] = [
            interval.sql_date_trunc(Event.timestamp)
            == interval.sql_date_trunc(timestamp_column),
        ]
        if customer_id is not None:
            event_clauses.append(Event.customer_id == customer_id)
        if external_customer_id is not None:
            event_clauses.append(Event.external_customer_id == external_customer_id)
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
        return [(row.timestamp, row[1]) async for row in result]


meter = MeterService()
