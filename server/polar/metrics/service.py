import uuid
from collections.abc import Callable
from datetime import UTC, date, datetime

from sqlalchemy import ColumnElement, Integer, cte, func, select

from polar.auth.models import AuthSubject
from polar.models import Order, Organization, Subscription, User
from polar.postgres import AsyncSession

from .schemas import Interval

METRICS: dict[str, Callable[[ColumnElement[datetime]], ColumnElement[int]]] = {
    "orders": lambda t: func.count(Order.id),
    "revenue": lambda t: func.sum(Order.amount),
    "average_order_value": lambda t: func.cast(
        func.ceil(func.avg(Order.amount)), Integer
    ),
    "one_time_products": lambda t: func.count(Order.id).filter(
        Order.subscription_id.is_(None)
    ),
    "one_time_products_revenue": lambda t: func.sum(Order.amount).filter(
        Order.subscription_id.is_(None)
    ),
    "new_subscriptions": lambda t: func.count(Subscription.id).filter(
        func.date_trunc("day", Subscription.started_at) == func.date_trunc("day", t)
    ),
    "new_subscriptions_revenue": lambda t: func.sum(Order.amount).filter(
        func.date_trunc("day", Subscription.started_at) == func.date_trunc("day", t)
    ),
    "renewed_subscriptions": lambda t: func.count(Subscription.id).filter(
        func.date_trunc("day", Subscription.started_at) != func.date_trunc("day", t)
    ),
    "renewed_subscriptions_revenue": lambda t: func.sum(Order.amount).filter(
        func.date_trunc("day", Subscription.started_at) != func.date_trunc("day", t)
    ),
}


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
    ):
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
                    func.coalesce(metric(timestamp_column), 0).label(metric_name)
                    for metric_name, metric in METRICS.items()
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

        result = await session.execute(statement)
        return list(result.all())


metrics = MetricsService()
