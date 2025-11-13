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
    Checkout,
    CheckoutProduct,
    Customer,
    Event,
    Order,
    Organization,
    Product,
    Subscription,
    User,
    UserOrganization,
)
from polar.models.product import ProductBillingType

if TYPE_CHECKING:
    from .metrics import SQLMetric


class MetricQuery(StrEnum):
    orders = "orders"
    cumulative_orders = "cumulative_orders"
    active_subscriptions = "active_subscriptions"
    checkouts = "checkouts"
    canceled_subscriptions = "canceled_subscriptions"
    costs = "costs"
    cumulative_costs = "cumulative_costs"
    events = "events"
    cumulative_events = "cumulative_events"


def _get_metrics_columns(
    metric_cte: MetricQuery,
    timestamp_column: ColumnElement[datetime],
    interval: TimeInterval,
    metrics: list["type[SQLMetric]"],
    now: datetime,
) -> Generator[ColumnElement[int] | ColumnElement[float], None, None]:
    return (
        func.coalesce(
            metric.get_sql_expression(timestamp_column, interval, now), 0
        ).label(metric.slug)
        for metric in metrics
        if metric.query == metric_cte
    )


class QueryCallable(Protocol):
    def __call__(
        self,
        timestamp_series: CTE,
        interval: TimeInterval,
        auth_subject: AuthSubject[User | Organization],
        metrics: list["type[SQLMetric]"],
        now: datetime,
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
    statement = select(Order.id).join(
        Product, onclause=Order.product_id == Product.id, isouter=True
    )

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
    metrics: list["type[SQLMetric]"],
    now: datetime,
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
                MetricQuery.orders, timestamp_column, interval, metrics, now
            ),
        )
        .select_from(
            timestamp_series.join(
                Order,
                isouter=True,
                onclause=and_(
                    interval.sql_date_trunc(Order.created_at)
                    == interval.sql_date_trunc(timestamp_column),
                    Order.paid.is_(True),
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
    metrics: list["type[SQLMetric]"],
    now: datetime,
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

    day_column = interval.sql_date_trunc(Order.created_at)

    daily_metrics = cte(
        select(
            day_column.label("day"),
            *[
                func.coalesce(
                    metric.get_sql_expression(day_column, interval, now), 0
                ).label(metric.slug)
                for metric in metrics
                if metric.query == MetricQuery.cumulative_orders
            ],
        )
        .select_from(Order)
        .join(
            Subscription,
            isouter=True,
            onclause=Order.subscription_id == Subscription.id,
        )
        .where(
            Order.paid.is_(True),
            Order.id.in_(readable_orders_statement),
        )
        .group_by(day_column)
    )

    return cte(
        select(
            timestamp_column.label("timestamp"),
            *[
                func.coalesce(
                    func.sum(getattr(daily_metrics.c, metric.slug)).over(
                        order_by=timestamp_column
                    ),
                    0,
                ).label(metric.slug)
                for metric in metrics
                if metric.query == MetricQuery.cumulative_orders
            ],
        )
        .select_from(
            timestamp_series.join(
                daily_metrics,
                onclause=daily_metrics.c.day == timestamp_column,
                isouter=True,
            )
        )
        .order_by(timestamp_column.asc())
    )


def get_active_subscriptions_cte(
    timestamp_series: CTE,
    interval: TimeInterval,
    auth_subject: AuthSubject[User | Organization],
    metrics: list["type[SQLMetric]"],
    now: datetime,
    *,
    organization_id: Sequence[uuid.UUID] | None = None,
    product_id: Sequence[uuid.UUID] | None = None,
    billing_type: Sequence[ProductBillingType] | None = None,
    customer_id: Sequence[uuid.UUID] | None = None,
) -> CTE:
    timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp

    readable_subscriptions_statement = _get_readable_subscriptions_statement(
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
                MetricQuery.active_subscriptions,
                timestamp_column,
                interval,
                metrics,
                now,
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
                        func.coalesce(Subscription.ended_at, Subscription.ends_at).is_(
                            None
                        ),
                        interval.sql_date_trunc(
                            cast(
                                SQLColumnExpression[datetime],
                                func.coalesce(
                                    Subscription.ended_at, Subscription.ends_at
                                ),
                            )
                        )
                        > interval.sql_date_trunc(timestamp_column),
                    ),
                    Subscription.id.in_(readable_subscriptions_statement),
                ),
            )
        )
        .group_by(timestamp_column)
        .order_by(timestamp_column.asc())
    )


def _get_readable_subscriptions_statement(
    auth_subject: AuthSubject[User | Organization],
    *,
    organization_id: Sequence[uuid.UUID] | None = None,
    product_id: Sequence[uuid.UUID] | None = None,
    billing_type: Sequence[ProductBillingType] | None = None,
    customer_id: Sequence[uuid.UUID] | None = None,
) -> Select[tuple[uuid.UUID]]:
    statement = select(Subscription.id).join(
        Product, onclause=Subscription.product_id == Product.id
    )

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
        statement = statement.where(Subscription.product_id.in_(product_id))

    if billing_type is not None:
        statement = statement.where(Product.billing_type.in_(billing_type))

    if customer_id is not None:
        statement = statement.join(
            Customer,
            onclause=Subscription.customer_id == Customer.id,
        ).where(Customer.id.in_(customer_id))

    return statement


def get_checkouts_cte(
    timestamp_series: CTE,
    interval: TimeInterval,
    auth_subject: AuthSubject[User | Organization],
    metrics: list["type[SQLMetric]"],
    now: datetime,
    *,
    organization_id: Sequence[uuid.UUID] | None = None,
    product_id: Sequence[uuid.UUID] | None = None,
    billing_type: Sequence[ProductBillingType] | None = None,
    customer_id: Sequence[uuid.UUID] | None = None,
) -> CTE:
    timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp

    readable_checkouts_statement = (
        select(Checkout.id)
        .join(CheckoutProduct, CheckoutProduct.checkout_id == Checkout.id)
        .join(Product, onclause=CheckoutProduct.product_id == Product.id)
    )

    if is_user(auth_subject):
        readable_checkouts_statement = readable_checkouts_statement.where(
            Product.organization_id.in_(
                select(UserOrganization.organization_id).where(
                    UserOrganization.user_id == auth_subject.subject.id,
                    UserOrganization.deleted_at.is_(None),
                )
            )
        )
    elif is_organization(auth_subject):
        readable_checkouts_statement = readable_checkouts_statement.where(
            Product.organization_id == auth_subject.subject.id
        )

    if organization_id is not None:
        readable_checkouts_statement = readable_checkouts_statement.where(
            Product.organization_id.in_(organization_id)
        )

    if product_id is not None:
        readable_checkouts_statement = readable_checkouts_statement.where(
            CheckoutProduct.product_id.in_(product_id)
        )

    if billing_type is not None:
        readable_checkouts_statement = readable_checkouts_statement.where(
            Product.billing_type.in_(billing_type)
        )

    if customer_id is not None:
        readable_checkouts_statement = readable_checkouts_statement.where(
            Checkout.customer_id.in_(customer_id)
        )

    return cte(
        select(
            timestamp_column.label("timestamp"),
            *_get_metrics_columns(
                MetricQuery.checkouts, timestamp_column, interval, metrics, now
            ),
        )
        .select_from(
            timestamp_series.join(
                Checkout,
                isouter=True,
                onclause=and_(
                    interval.sql_date_trunc(Checkout.created_at)
                    == interval.sql_date_trunc(timestamp_column),
                    Checkout.id.in_(readable_checkouts_statement),
                ),
            )
        )
        .group_by(timestamp_column)
        .order_by(timestamp_column.asc())
    )


def get_canceled_subscriptions_cte(
    timestamp_series: CTE,
    interval: TimeInterval,
    auth_subject: AuthSubject[User | Organization],
    metrics: list["type[SQLMetric]"],
    now: datetime,
    *,
    organization_id: Sequence[uuid.UUID] | None = None,
    product_id: Sequence[uuid.UUID] | None = None,
    billing_type: Sequence[ProductBillingType] | None = None,
    customer_id: Sequence[uuid.UUID] | None = None,
) -> CTE:
    timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp

    readable_subscriptions_statement = _get_readable_subscriptions_statement(
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
                MetricQuery.canceled_subscriptions,
                timestamp_column,
                interval,
                metrics,
                now,
            ),
        )
        .select_from(
            timestamp_series.join(
                Subscription,
                isouter=True,
                onclause=and_(
                    Subscription.canceled_at.is_not(None),
                    interval.sql_date_trunc(
                        cast(SQLColumnExpression[datetime], Subscription.canceled_at)
                    )
                    == interval.sql_date_trunc(timestamp_column),
                    Subscription.id.in_(readable_subscriptions_statement),
                ),
            )
        )
        .group_by(timestamp_column)
        .order_by(timestamp_column.asc())
    )


def _get_readable_cost_events_statement(
    *,
    auth_subject: AuthSubject[User | Organization],
    organization_id: Sequence[uuid.UUID] | None = None,
    customer_id: Sequence[uuid.UUID] | None = None,
) -> Select[tuple[uuid.UUID]]:
    statement = select(Event.id).where(Event.user_metadata["_cost"].is_not(None))

    if is_user(auth_subject):
        statement = statement.where(
            Event.organization_id.in_(
                select(UserOrganization.organization_id).where(
                    UserOrganization.user_id == auth_subject.subject.id,
                    UserOrganization.deleted_at.is_(None),
                )
            )
        )
    elif is_organization(auth_subject):
        statement = statement.where(Event.organization_id == auth_subject.subject.id)

    if organization_id is not None:
        statement = statement.where(Event.organization_id.in_(organization_id))

    if customer_id is not None:
        statement = statement.join(
            Customer,
            onclause=or_(
                Event.customer_id == Customer.id,
                and_(
                    Customer.external_id.is_not(None),
                    Event.external_customer_id == Customer.external_id,
                    Event.organization_id == Customer.organization_id,
                ),
            ),
        ).where(Customer.id.in_(customer_id))

    return statement


def get_cost_events_cte(
    timestamp_series: CTE,
    interval: TimeInterval,
    auth_subject: AuthSubject[User | Organization],
    metrics: list["type[SQLMetric]"],
    now: datetime,
    *,
    organization_id: Sequence[uuid.UUID] | None = None,
    customer_id: Sequence[uuid.UUID] | None = None,
    product_id: Sequence[uuid.UUID] | None = None,
    billing_type: Sequence[ProductBillingType] | None = None,
) -> CTE:
    timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp

    readable_cost_events_statement = _get_readable_cost_events_statement(
        auth_subject=auth_subject,
        organization_id=organization_id,
        customer_id=customer_id,
    )

    return cte(
        select(
            timestamp_column.label("timestamp"),
            *_get_metrics_columns(
                MetricQuery.costs, timestamp_column, interval, metrics, now
            ),
        )
        .select_from(
            timestamp_series.join(
                Event,
                isouter=True,
                onclause=and_(
                    interval.sql_date_trunc(Event.timestamp)
                    == interval.sql_date_trunc(timestamp_column),
                    Event.id.in_(readable_cost_events_statement),
                ),
            )
        )
        .group_by(timestamp_column)
        .order_by(timestamp_column.asc())
    )


def get_cumulative_cost_events_cte(
    timestamp_series: CTE,
    interval: TimeInterval,
    auth_subject: AuthSubject[User | Organization],
    metrics: list["type[SQLMetric]"],
    now: datetime,
    *,
    organization_id: Sequence[uuid.UUID] | None = None,
    customer_id: Sequence[uuid.UUID] | None = None,
    product_id: Sequence[uuid.UUID] | None = None,
    billing_type: Sequence[ProductBillingType] | None = None,
) -> CTE:
    timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp

    readable_cost_events_statement = _get_readable_cost_events_statement(
        auth_subject=auth_subject,
        organization_id=organization_id,
        customer_id=customer_id,
    )

    day_column = interval.sql_date_trunc(Event.timestamp)

    daily_metrics = cte(
        select(
            day_column.label("day"),
            *[
                func.coalesce(
                    metric.get_sql_expression(day_column, interval, now), 0
                ).label(metric.slug)
                for metric in metrics
                if metric.query == MetricQuery.cumulative_costs
            ],
        )
        .select_from(Event)
        .where(Event.id.in_(readable_cost_events_statement))
        .group_by(day_column)
    )

    return cte(
        select(
            timestamp_column.label("timestamp"),
            *[
                func.coalesce(
                    func.sum(getattr(daily_metrics.c, metric.slug)).over(
                        order_by=timestamp_column
                    ),
                    0,
                ).label(metric.slug)
                for metric in metrics
                if metric.query == MetricQuery.cumulative_costs
            ],
        )
        .select_from(
            timestamp_series.join(
                daily_metrics,
                onclause=daily_metrics.c.day == timestamp_column,
                isouter=True,
            )
        )
        .order_by(timestamp_column.asc())
    )


def _get_readable_events_statement(
    auth_subject: AuthSubject[User | Organization],
    *,
    organization_id: Sequence[uuid.UUID] | None = None,
    customer_id: Sequence[uuid.UUID] | None = None,
) -> Select[tuple[uuid.UUID]]:
    statement = select(Event.id)

    if is_user(auth_subject):
        statement = statement.where(
            Event.organization_id.in_(
                select(UserOrganization.organization_id).where(
                    UserOrganization.user_id == auth_subject.subject.id,
                    UserOrganization.deleted_at.is_(None),
                )
            )
        )
    elif is_organization(auth_subject):
        statement = statement.where(Event.organization_id == auth_subject.subject.id)

    if organization_id is not None:
        statement = statement.where(Event.organization_id.in_(organization_id))

    if customer_id is not None:
        statement = statement.join(
            Customer,
            onclause=or_(
                Event.customer_id == Customer.id,
                and_(
                    Customer.external_id.is_not(None),
                    Event.external_customer_id == Customer.external_id,
                    Event.organization_id == Customer.organization_id,
                ),
            ),
        ).where(Customer.id.in_(customer_id))

    return statement


def get_events_cte(
    timestamp_series: CTE,
    interval: TimeInterval,
    auth_subject: AuthSubject[User | Organization],
    metrics: list["type[SQLMetric]"],
    now: datetime,
    *,
    organization_id: Sequence[uuid.UUID] | None = None,
    customer_id: Sequence[uuid.UUID] | None = None,
    product_id: Sequence[uuid.UUID] | None = None,
    billing_type: Sequence[ProductBillingType] | None = None,
) -> CTE:
    timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp

    readable_events_statement = _get_readable_events_statement(
        auth_subject,
        organization_id=organization_id,
        customer_id=customer_id,
    )

    return cte(
        select(
            timestamp_column.label("timestamp"),
            *_get_metrics_columns(
                MetricQuery.events, timestamp_column, interval, metrics, now
            ),
        )
        .select_from(
            timestamp_series.join(
                Event,
                isouter=True,
                onclause=and_(
                    interval.sql_date_trunc(Event.timestamp)
                    == interval.sql_date_trunc(timestamp_column),
                    Event.id.in_(readable_events_statement),
                ),
            )
        )
        .group_by(timestamp_column)
        .order_by(timestamp_column.asc())
    )


def get_cumulative_events_cte(
    timestamp_series: CTE,
    interval: TimeInterval,
    auth_subject: AuthSubject[User | Organization],
    metrics: list["type[SQLMetric]"],
    now: datetime,
    *,
    organization_id: Sequence[uuid.UUID] | None = None,
    customer_id: Sequence[uuid.UUID] | None = None,
    product_id: Sequence[uuid.UUID] | None = None,
    billing_type: Sequence[ProductBillingType] | None = None,
) -> CTE:
    timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp

    readable_events_statement = _get_readable_events_statement(
        auth_subject,
        organization_id=organization_id,
        customer_id=customer_id,
    )

    day_column = interval.sql_date_trunc(Event.timestamp)

    daily_metrics = cte(
        select(
            day_column.label("day"),
            *[
                func.coalesce(
                    metric.get_sql_expression(day_column, interval, now), 0
                ).label(metric.slug)
                for metric in metrics
                if metric.query == MetricQuery.cumulative_events
            ],
        )
        .select_from(Event)
        .where(Event.id.in_(readable_events_statement))
        .group_by(day_column)
    )

    return cte(
        select(
            timestamp_column.label("timestamp"),
            *[
                func.coalesce(
                    func.sum(getattr(daily_metrics.c, metric.slug)).over(
                        order_by=timestamp_column
                    ),
                    0,
                ).label(metric.slug)
                for metric in metrics
                if metric.query == MetricQuery.cumulative_events
            ],
        )
        .select_from(
            timestamp_series.join(
                daily_metrics,
                onclause=daily_metrics.c.day == timestamp_column,
                isouter=True,
            )
        )
        .order_by(timestamp_column.asc())
    )


QUERIES: list[QueryCallable] = [
    get_orders_cte,
    get_cumulative_orders_cte,
    get_active_subscriptions_cte,
    get_checkouts_cte,
    get_canceled_subscriptions_cte,
    get_cost_events_cte,
    get_cumulative_cost_events_cte,
    get_events_cte,
    get_cumulative_events_cte,
]
