import uuid
from collections.abc import Sequence
from datetime import date, datetime
from zoneinfo import ZoneInfo

import logfire
from sqlalchemy import ColumnElement, FromClause, select, text

from polar.auth.models import AuthSubject
from polar.config import settings
from polar.kit.time_queries import TimeInterval, get_timestamp_series_cte
from polar.models import Organization, User
from polar.models.product import ProductBillingType
from polar.postgres import AsyncReadSession, AsyncSession

from .metrics import METRICS, METRICS_POST_COMPUTE, METRICS_SQL
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

        # Truncate start_timestamp to the beginning of the interval period
        # This ensures the timestamp series aligns with how daily metrics are grouped
        if interval == TimeInterval.month:
            start_timestamp = start_timestamp.replace(day=1)
        elif interval == TimeInterval.year:
            start_timestamp = start_timestamp.replace(month=1, day=1)

        timestamp_series = get_timestamp_series_cte(
            start_timestamp, end_timestamp, interval
        )
        timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp

        queries = [
            query(
                timestamp_series,
                interval,
                auth_subject,
                METRICS_SQL,
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

        periods: list[MetricsPeriod] = []
        with logfire.span(
            "Stream and process metrics query",
            start_date=str(start_date),
            end_date=str(end_date),
        ):
            result = await session.stream(
                statement,
                execution_options={"yield_per": settings.DATABASE_STREAM_YIELD_PER},
            )

            row_count = 0
            with logfire.span("Fetch and process rows"):
                async for row in result:
                    row_count += 1
                    period_dict = row._asdict()

                    for meta_metric in METRICS_POST_COMPUTE:
                        period_dict[meta_metric.slug] = 0

                    temp_period = MetricsPeriod(**period_dict)

                    for meta_metric in METRICS_POST_COMPUTE:
                        period_dict[meta_metric.slug] = meta_metric.compute_from_period(
                            temp_period
                        )

                    periods.append(MetricsPeriod(**period_dict))

            logfire.info("Processed {row_count} rows", row_count=row_count)

        totals: dict[str, int | float] = {}
        with logfire.span(
            "Get cumulative metrics",
            start_date=str(start_date),
            end_date=str(end_date),
        ):
            for metric in METRICS:
                totals[metric.slug] = metric.get_cumulative(periods)

        return MetricsResponse.model_validate(
            {
                "periods": periods,
                "totals": totals,
                "metrics": {m.slug: m for m in METRICS},
            }
        )


metrics = MetricsService()
