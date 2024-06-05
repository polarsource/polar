import uuid
from datetime import UTC, date, datetime

from sqlalchemy import ColumnElement, FromClause, select

from polar.auth.models import AuthSubject
from polar.models import Organization, User
from polar.postgres import AsyncSession

from .metrics import METRICS
from .queries import QUERIES, Interval, get_timestamp_series_cte
from .schemas import MetricsPeriod, MetricsResponse


class MetricsService:
    async def get_metrics(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        start_date: date,
        end_date: date,
        interval: Interval,
        organization_id: uuid.UUID | None = None,
        product_id: uuid.UUID | None = None,
    ) -> MetricsResponse:
        start_timestamp = datetime(
            start_date.year, start_date.month, start_date.day, 0, 0, 0, 0, UTC
        )
        end_timestamp = datetime(
            end_date.year, end_date.month, end_date.day, 23, 59, 59, 999999, UTC
        )

        timestamp_series = get_timestamp_series_cte(
            start_timestamp, end_timestamp, interval
        )
        timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp

        queries = [
            query(timestamp_series, interval, auth_subject, METRICS)
            for query in QUERIES
        ]

        from_query: FromClause = timestamp_series
        for query in queries:
            from_query = from_query.join(
                query,
                onclause=query.c.timestamp == timestamp_column,
            )

        statement = (
            select(
                timestamp_column.label("timestamp"),
                *queries,
            )
            .select_from(from_query)
            .order_by(timestamp_column.asc())
        )

        result = await session.stream(statement)
        periods: list[MetricsPeriod] = []
        async for row in result:
            periods.append(MetricsPeriod(**row._asdict()))
        return MetricsResponse.model_validate(
            {"periods": periods, "metrics": {m.slug: m for m in METRICS}}
        )


metrics = MetricsService()
