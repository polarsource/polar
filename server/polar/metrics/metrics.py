from datetime import datetime
from enum import StrEnum
from typing import ClassVar, Protocol, cast

from sqlalchemy import (
    ColumnElement,
    Float,
    Integer,
    SQLColumnExpression,
    case,
    func,
    type_coerce,
)

from polar.enums import SubscriptionRecurringInterval
from polar.kit.time_queries import TimeInterval
from polar.models import Checkout, Order, Subscription
from polar.models.checkout import CheckoutStatus

from .queries import MetricQuery


class MetricType(StrEnum):
    scalar = "scalar"
    currency = "currency"
    percentage = "percentage"


class Metric(Protocol):
    slug: ClassVar[str]
    display_name: ClassVar[str]
    type: ClassVar[MetricType]
    query: ClassVar[MetricQuery]

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval
    ) -> ColumnElement[int] | ColumnElement[float]: ...


class OrdersMetric(Metric):
    slug = "orders"
    display_name = "Orders"
    type = MetricType.scalar
    query = MetricQuery.orders

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval
    ) -> ColumnElement[int]:
        return func.count(Order.id)


class RevenueMetric(Metric):
    slug = "revenue"
    display_name = "Revenue"
    type = MetricType.currency
    query = MetricQuery.orders

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval
    ) -> ColumnElement[int]:
        return func.sum(Order.net_amount)


class CumulativeRevenueMetric(Metric):
    slug = "cumulative_revenue"
    display_name = "Cumulative Revenue"
    type = MetricType.currency
    query = MetricQuery.cumulative_orders

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval
    ) -> ColumnElement[int]:
        return func.sum(Order.net_amount)


class AverageOrderValueMetric(Metric):
    slug = "average_order_value"
    display_name = "Average Order Value"
    type = MetricType.currency
    query = MetricQuery.orders

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval
    ) -> ColumnElement[int]:
        return func.cast(func.ceil(func.avg(Order.net_amount)), Integer)


class OneTimeProductsMetric(Metric):
    slug = "one_time_products"
    display_name = "One-Time Products"
    type = MetricType.scalar
    query = MetricQuery.orders

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval
    ) -> ColumnElement[int]:
        return func.count(Order.id).filter(Order.subscription_id.is_(None))


class OneTimeProductsRevenueMetric(Metric):
    slug = "one_time_products_revenue"
    display_name = "One-Time Products Revenue"
    type = MetricType.currency
    query = MetricQuery.orders

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval
    ) -> ColumnElement[int]:
        return func.sum(Order.net_amount).filter(Order.subscription_id.is_(None))


class NewSubscriptionsMetric(Metric):
    slug = "new_subscriptions"
    display_name = "New Subscriptions"
    type = MetricType.scalar
    query = MetricQuery.active_subscriptions

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval
    ) -> ColumnElement[int]:
        return func.count(Subscription.id).filter(
            i.sql_date_trunc(
                cast(SQLColumnExpression[datetime], Subscription.started_at)
            )
            == i.sql_date_trunc(t)
        )


class NewSubscriptionsRevenueMetric(Metric):
    slug = "new_subscriptions_revenue"
    display_name = "New Subscriptions Revenue"
    type = MetricType.currency
    query = MetricQuery.orders

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval
    ) -> ColumnElement[int]:
        return func.sum(Order.net_amount).filter(
            i.sql_date_trunc(
                cast(SQLColumnExpression[datetime], Subscription.started_at)
            )
            == i.sql_date_trunc(t)
        )


class RenewedSubscriptionsMetric(Metric):
    slug = "renewed_subscriptions"
    display_name = "Renewed Subscriptions"
    type = MetricType.scalar
    query = MetricQuery.orders

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval
    ) -> ColumnElement[int]:
        return func.count(Subscription.id.distinct()).filter(
            i.sql_date_trunc(
                cast(SQLColumnExpression[datetime], Subscription.started_at)
            )
            != i.sql_date_trunc(t)
        )


class RenewedSubscriptionsRevenueMetric(Metric):
    slug = "renewed_subscriptions_revenue"
    display_name = "Renewed Subscriptions Revenue"
    type = MetricType.currency
    query = MetricQuery.orders

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval
    ) -> ColumnElement[int]:
        return func.sum(Order.net_amount).filter(
            i.sql_date_trunc(
                cast(SQLColumnExpression[datetime], Subscription.started_at)
            )
            != i.sql_date_trunc(t)
        )


class ActiveSubscriptionsMetric(Metric):
    slug = "active_subscriptions"
    display_name = "Active Subscriptions"
    type = MetricType.scalar
    query = MetricQuery.active_subscriptions

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval
    ) -> ColumnElement[int]:
        return func.count(Subscription.id)


class MonthlyRecurringRevenueMetric(Metric):
    slug = "monthly_recurring_revenue"
    display_name = "Monthly Recurring Revenue"
    type = MetricType.currency
    query = MetricQuery.active_subscriptions

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval
    ) -> ColumnElement[int]:
        return func.coalesce(
            func.sum(
                case(
                    (
                        Subscription.recurring_interval
                        == SubscriptionRecurringInterval.year,
                        func.round(Subscription.amount / 12),
                    ),
                    (
                        Subscription.recurring_interval
                        == SubscriptionRecurringInterval.month,
                        Subscription.amount,
                    ),
                )
            ),
            0,
        )


class CheckoutsMetric(Metric):
    slug = "checkouts"
    display_name = "Checkouts"
    type = MetricType.scalar
    query = MetricQuery.checkouts

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval
    ) -> ColumnElement[int]:
        return func.count(Checkout.id)


class SucceededCheckoutsMetric(Metric):
    slug = "succeeded_checkouts"
    display_name = "Succeeded Checkouts"
    type = MetricType.scalar
    query = MetricQuery.checkouts

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval
    ) -> ColumnElement[int]:
        return func.count(Checkout.id).filter(
            Checkout.status == CheckoutStatus.succeeded
        )


class CheckoutsConversionMetric(Metric):
    slug = "checkouts_conversion"
    display_name = "Checkouts Conversion Rate"
    type = MetricType.percentage
    query = MetricQuery.checkouts

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval
    ) -> ColumnElement[float]:
        return type_coerce(
            func.count(Checkout.id).filter(Checkout.status == CheckoutStatus.succeeded)
            / func.count(Checkout.id),
            Float,
        )


METRICS: list[type[Metric]] = [
    OrdersMetric,
    RevenueMetric,
    CumulativeRevenueMetric,
    AverageOrderValueMetric,
    OneTimeProductsMetric,
    OneTimeProductsRevenueMetric,
    NewSubscriptionsMetric,
    NewSubscriptionsRevenueMetric,
    RenewedSubscriptionsMetric,
    RenewedSubscriptionsRevenueMetric,
    ActiveSubscriptionsMetric,
    MonthlyRecurringRevenueMetric,
    CheckoutsMetric,
    SucceededCheckoutsMetric,
    CheckoutsConversionMetric,
]

__all__ = ["MetricType", "Metric", "METRICS"]
