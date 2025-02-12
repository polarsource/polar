import uuid
from collections.abc import Generator, Sequence
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Protocol, cast

from sqlalchemy import (
    CTE,
    ColumnElement,
    Select,
    SQLColumnExpression,
    and_,
    cte,
    func,
    or_,
    select,
)

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.kit.time_queries import TimeInterval
from polar.models import (
    Customer,
    Order,
    Organization,
    Product,
    ProductPrice,
    Subscription,
    User,
    UserOrganization,
)
from polar.models.product import ProductBillingType

if TYPE_CHECKING:
    from .metrics import Metric


class MetricQuery(StrEnum):
    orders = "orders"
    cumulative_orders = "cumulative_orders"
    active_subscriptions = "active_subscriptions"


def _get_metrics_columns(
    metric_cte: MetricQuery,
    timestamp_column: ColumnElement[datetime],
    interval: TimeInterval,
    metrics: list["type[Metric]"],
) -> Generator[ColumnElement[int], None, None]:
    return (
        func.coalesce(metric.get_sql_expression(timestamp_column, interval), 0).label(
            metric.slug
        )
        for metric in metrics
        if metric.query == metric_cte
    )


class QueryCallable(Protocol):
    def __call__(
        self,
        timestamp_series: CTE,
        interval: TimeInterval,
        auth_subject: AuthSubject[User | Organization],
        metrics: list["type[Metric]"],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        product_id: Sequence[uuid.UUID] | None = None,
        billing_type: Sequence[ProductBillingType] | None = None,
        customer_id: Sequence[uuid.UUID] | None = None,
    ) -> CTE: ...


def _get_readable_orders_statement(
    auth_subject: AuthSubject[User | Organization],
    *,
    organization_id: Sequence[uuid.UUID] | None = None,
    product_id: Sequence[uuid.UUID] | None = None,
    billing_type: Sequence[ProductBillingType] | None = None,
    customer_id: Sequence[uuid.UUID] | None = None,
) -> Select[tuple[uuid.UUID]]:
    statement = select(Order.id).join(Product, onclause=Order.product_id == Product.id)

    if is_user(auth_subject):
        statement = statement.where(
            Product.organization_id.in_(
                select(UserOrganization.organization_id).where(
                    UserOrganization.user_id == auth_subject.subject.id,
                    UserOrganization.deleted_at.is_(None),
                )
            )
        )
    elif is_organization(auth_subject):
        statement = statement.where(Product.organization_id == auth_subject.subject.id)

    if organization_id is not None:
        statement = statement.where(Product.organization_id.in_(organization_id))

    if product_id is not None:
        statement = statement.where(Order.product_id.in_(product_id))

    if billing_type is not None:
        statement = statement.where(Product.billing_type.in_(billing_type))

    if customer_id is not None:
        statement = statement.join(
            Customer,
            onclause=Order.customer_id == Customer.id,
        ).where(Customer.id.in_(customer_id))

    return statement


def get_orders_cte(
    timestamp_series: CTE,
    interval: TimeInterval,
    auth_subject: AuthSubject[User | Organization],
    metrics: list["type[Metric]"],
    *,
    organization_id: Sequence[uuid.UUID] | None = None,
    product_id: Sequence[uuid.UUID] | None = None,
    billing_type: Sequence[ProductBillingType] | None = None,
    customer_id: Sequence[uuid.UUID] | None = None,
) -> CTE:
    timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp

    readable_orders_statement = _get_readable_orders_statement(
        auth_subject,
        organization_id=organization_id,
        product_id=product_id,
        billing_type=billing_type,
        customer_id=customer_id,
    )

    return cte(
        select(
            timestamp_column.label("timestamp"),
            *_get_metrics_columns(
                MetricQuery.orders, timestamp_column, interval, metrics
            ),
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


def get_cumulative_orders_cte(
    timestamp_series: CTE,
    interval: TimeInterval,
    auth_subject: AuthSubject[User | Organization],
    metrics: list["type[Metric]"],
    *,
    organization_id: Sequence[uuid.UUID] | None = None,
    product_id: Sequence[uuid.UUID] | None = None,
    billing_type: Sequence[ProductBillingType] | None = None,
    customer_id: Sequence[uuid.UUID] | None = None,
) -> CTE:
    timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp

    readable_orders_statement = _get_readable_orders_statement(
        auth_subject,
        organization_id=organization_id,
        product_id=product_id,
        billing_type=billing_type,
        customer_id=customer_id,
    )

    return cte(
        select(
            timestamp_column.label("timestamp"),
            *_get_metrics_columns(
                MetricQuery.cumulative_orders, timestamp_column, interval, metrics
            ),
        )
        .select_from(
            timestamp_series.join(
                Order,
                isouter=True,
                onclause=and_(
                    interval.sql_date_trunc(Order.created_at)
                    <= interval.sql_date_trunc(timestamp_column),
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
    interval: TimeInterval,
    auth_subject: AuthSubject[User | Organization],
    metrics: list["type[Metric]"],
    *,
    organization_id: Sequence[uuid.UUID] | None = None,
    product_id: Sequence[uuid.UUID] | None = None,
    billing_type: Sequence[ProductBillingType] | None = None,
    customer_id: Sequence[uuid.UUID] | None = None,
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
                )
            )
        )
    elif is_organization(auth_subject):
        readable_subscriptions_statement = readable_subscriptions_statement.where(
            Product.organization_id == auth_subject.subject.id
        )

    if organization_id is not None:
        readable_subscriptions_statement = readable_subscriptions_statement.where(
            Product.organization_id.in_(organization_id)
        )

    if product_id is not None:
        readable_subscriptions_statement = readable_subscriptions_statement.where(
            Subscription.product_id.in_(product_id)
        )

    if billing_type is not None:
        readable_subscriptions_statement = readable_subscriptions_statement.where(
            Product.billing_type.in_(billing_type)
        )

    if customer_id is not None:
        readable_subscriptions_statement = readable_subscriptions_statement.join(
            Customer,
            onclause=Subscription.customer_id == Customer.id,
        ).where(Customer.id.in_(customer_id))

    return cte(
        select(
            timestamp_column.label("timestamp"),
            *_get_metrics_columns(
                MetricQuery.active_subscriptions, timestamp_column, interval, metrics
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
                        >= interval.sql_date_trunc(timestamp_column),
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
    get_cumulative_orders_cte,
    get_active_subscriptions_cte,
]
