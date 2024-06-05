import uuid
from datetime import UTC, date, datetime
from enum import StrEnum

from sqlalchemy import (
    ColumnElement,
    Function,
    SQLColumnExpression,
    TextClause,
    cte,
    func,
    select,
    text,
)

from polar.auth.models import AuthSubject
from polar.models import Order, Organization, Subscription, User
from polar.postgres import AsyncSession

from .metrics import METRICS
from .schemas import MetricsPeriod, MetricsResponse


class Interval(StrEnum):
    year = "year"
    month = "month"
    week = "week"
    day = "day"
    hour = "hour"

    def sql_interval(self) -> TextClause:
        return text(f"'1 {self.value}'::interval")

    def sql_date_trunc(
        self, column: SQLColumnExpression[datetime]
    ) -> Function[datetime]:
        return func.date_trunc(self.value, column)


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

        timestamp_series = cte(
            select(
                func.generate_series(
                    start_timestamp, end_timestamp, interval.sql_interval()
                ).column_valued("timestamp")
            )
        )
        timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp
        statement = (
            select(
                timestamp_column.label("timestamp"),
                *(
                    func.coalesce(metric.get_sql_expression(timestamp_column), 0).label(
                        metric.slug
                    )
                    for metric in METRICS
                ),
            )
            .select_from(
                timestamp_series.join(
                    Order,
                    isouter=True,
                    onclause=interval.sql_date_trunc(Order.created_at)
                    == interval.sql_date_trunc(timestamp_column),
                ).join(
                    Subscription,
                    isouter=True,
                    onclause=Order.subscription_id == Subscription.id,
                )
            )
            .group_by(timestamp_column)
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
