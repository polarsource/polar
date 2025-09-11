import uuid
from collections.abc import Sequence
from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy import ColumnElement, FromClause, select, text

from polar.auth.models import AuthSubject
from polar.kit.time_queries import TimeInterval, get_timestamp_series_cte
from polar.models import Organization, User
from polar.models.product import ProductBillingType
from polar.postgres import AsyncReadSession, AsyncSession

from .metrics import METRICS
from .queries import QUERIES
from .schemas import MetricsPeriod, MetricsResponse


class MetricsService:
    async def get_metrics(
        self,
        session: AsyncSession | AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        start_date: date,
        end_date: date,
        timezone: ZoneInfo,
        interval: TimeInterval,
        organization_id: Sequence[uuid.UUID] | None = None,
        product_id: Sequence[uuid.UUID] | None = None,
        billing_type: Sequence[ProductBillingType] | None = None,
        customer_id: Sequence[uuid.UUID] | None = None,
        now: datetime | None = None,
    ) -> MetricsResponse:
        await session.execute(text(f"SET LOCAL TIME ZONE '{timezone.key}'"))
        start_timestamp = datetime(
            start_date.year, start_date.month, start_date.day, 0, 0, 0, 0, timezone
        )
        end_timestamp = datetime(
            end_date.year, end_date.month, end_date.day, 23, 59, 59, 999999, timezone
        )

        timestamp_series = get_timestamp_series_cte(
            start_timestamp, end_timestamp, interval
        )
        timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp

        queries = [
            query(
                timestamp_series,
                interval,
                auth_subject,
                METRICS,
                now or datetime.now(tz=timezone),
                organization_id=organization_id,
                product_id=product_id,
                billing_type=billing_type,
                customer_id=customer_id,
            )
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

        totals: dict[str, int | float] = {}
        for metric in METRICS:
            totals[metric.slug] = metric.get_cumulative_function()(
                getattr(p, metric.slug) for p in periods
            )

        return MetricsResponse.model_validate(
            {
                "periods": periods,
                "totals": totals,
                "metrics": {m.slug: m for m in METRICS},
            }
        )


metrics = MetricsService()
