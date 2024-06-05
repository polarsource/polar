from collections.abc import Callable, Generator
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, cast

from sqlalchemy import (
    CTE,
    ColumnElement,
    Function,
    SQLColumnExpression,
    TextClause,
    and_,
    cte,
    func,
    or_,
    select,
    text,
)

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.models import (
    Order,
    Organization,
    Product,
    ProductPrice,
    Subscription,
    User,
    UserOrganization,
)

if TYPE_CHECKING:
    from .metrics import Metric


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


class MetricQuery(StrEnum):
    orders = "orders"
    active_subscriptions = "active_subscriptions"


def get_timestamp_series_cte(
    start_timestamp: datetime, end_timestamp: datetime, interval: Interval
) -> CTE:
    return cte(
        select(
            func.generate_series(
                start_timestamp, end_timestamp, interval.sql_interval()
            ).column_valued("timestamp")
        )
    )


def _get_metrics_columns(
    metric_cte: MetricQuery,
    timestamp_column: ColumnElement[datetime],
    metrics: list["type[Metric]"],
) -> Generator[ColumnElement[int], None, None]:
    return (
        func.coalesce(metric.get_sql_expression(timestamp_column), 0).label(metric.slug)
        for metric in metrics
        if metric.query == metric_cte
    )


QueryCallable = Callable[
    [
        CTE,
        Interval,
        AuthSubject[User | Organization],
        list["type[Metric]"],
    ],
    CTE,
]


def get_orders_cte(
    timestamp_series: CTE,
    interval: Interval,
    auth_subject: AuthSubject[User | Organization],
    metrics: list["type[Metric]"],
) -> CTE:
    timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp

    readable_orders_statement = select(Order.id).join(
        Product, onclause=Order.product_id == Product.id
    )
    if is_user(auth_subject):
        readable_orders_statement = readable_orders_statement.where(
            Product.organization_id.in_(
                select(UserOrganization.organization_id).where(
                    UserOrganization.user_id == auth_subject.subject.id,
                    UserOrganization.deleted_at.is_(None),
                    UserOrganization.is_admin.is_(True),
                )
            )
        )
    elif is_organization(auth_subject):
        readable_orders_statement = readable_orders_statement.where(
            Product.organization_id == auth_subject.subject.id
        )

    return cte(
        select(
            timestamp_column.label("timestamp"),
            *_get_metrics_columns(MetricQuery.orders, timestamp_column, metrics),
        )
        .select_from(
            timestamp_series.join(
                Order,
                isouter=True,
                onclause=and_(
                    interval.sql_date_trunc(Order.created_at)
                    == interval.sql_date_trunc(timestamp_column),
                    Order.id.in_(readable_orders_statement),
                ),
            ).join(
                Subscription,
                isouter=True,
                onclause=Order.subscription_id == Subscription.id,
            )
        )
        .group_by(timestamp_column)
        .order_by(timestamp_column.asc())
    )


def get_active_subscriptions_cte(
    timestamp_series: CTE,
    interval: Interval,
    auth_subject: AuthSubject[User | Organization],
    metrics: list["type[Metric]"],
) -> CTE:
    timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp

    readable_subscriptions_statement = select(Subscription.id).join(
        Product, onclause=Subscription.product_id == Product.id
    )
    if is_user(auth_subject):
        readable_subscriptions_statement = readable_subscriptions_statement.where(
            Product.organization_id.in_(
                select(UserOrganization.organization_id).where(
                    UserOrganization.user_id == auth_subject.subject.id,
                    UserOrganization.deleted_at.is_(None),
                    UserOrganization.is_admin.is_(True),
                )
            )
        )
    elif is_organization(auth_subject):
        readable_subscriptions_statement = readable_subscriptions_statement.where(
            Product.organization_id == auth_subject.subject.id
        )

    return cte(
        select(
            timestamp_column.label("timestamp"),
            *_get_metrics_columns(
                MetricQuery.active_subscriptions, timestamp_column, metrics
            ),
        )
        .select_from(
            timestamp_series.join(
                Subscription,
                isouter=True,
                onclause=and_(
                    or_(
                        Subscription.started_at.is_(None),
                        interval.sql_date_trunc(
                            cast(SQLColumnExpression[datetime], Subscription.started_at)
                        )
                        <= interval.sql_date_trunc(timestamp_column),
                    ),
                    or_(
                        Subscription.ended_at.is_(None),
                        interval.sql_date_trunc(
                            cast(SQLColumnExpression[datetime], Subscription.ended_at)
                        )
                        > interval.sql_date_trunc(timestamp_column),
                    ),
                    Subscription.id.in_(readable_subscriptions_statement),
                ),
            ).join(
                ProductPrice,
                isouter=True,
                onclause=Subscription.price_id == ProductPrice.id,
            )
        )
        .group_by(timestamp_column)
        .order_by(timestamp_column.asc())
    )


QUERIES: list[QueryCallable] = [
    get_orders_cte,
    get_active_subscriptions_cte,
]
