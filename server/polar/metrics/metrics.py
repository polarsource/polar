from datetime import datetime
from enum import StrEnum
from typing import ClassVar, Protocol

from sqlalchemy import ColumnElement, Integer, func

from polar.models import Order, Subscription


class MetricType(StrEnum):
    scalar = "scalar"
    currency = "currency"


class Metric(Protocol):
    slug: ClassVar[str]
    display_name: ClassVar[str]
    type: ClassVar[MetricType]

    @classmethod
    def get_sql_expression(cls, t: ColumnElement[datetime]) -> ColumnElement[int]: ...


class OrdersMetric(Metric):
    slug = "orders"
    display_name = "Orders"
    type = MetricType.scalar

    @classmethod
    def get_sql_expression(cls, t: ColumnElement[datetime]) -> ColumnElement[int]:
        return func.count(Order.id)


class RevenueMetric(Metric):
    slug = "revenue"
    display_name = "Revenue"
    type = MetricType.currency

    @classmethod
    def get_sql_expression(cls, t: ColumnElement[datetime]) -> ColumnElement[int]:
        return func.sum(Order.amount)


class AverageOrderValueMetric(Metric):
    slug = "average_order_value"
    display_name = "Average Order Value"
    type = MetricType.scalar

    @classmethod
    def get_sql_expression(cls, t: ColumnElement[datetime]) -> ColumnElement[int]:
        return func.cast(func.ceil(func.avg(Order.amount)), Integer)


class OneTimeProductsMetric(Metric):
    slug = "one_time_products"
    display_name = "One-Time Products"
    type = MetricType.scalar

    @classmethod
    def get_sql_expression(cls, t: ColumnElement[datetime]) -> ColumnElement[int]:
        return func.count(Order.id).filter(Order.subscription_id.is_(None))


class OneTimeProductsRevenueMetric(Metric):
    slug = "one_time_products_revenue"
    display_name = "One-Time Products Revenue"
    type = MetricType.currency

    @classmethod
    def get_sql_expression(cls, t: ColumnElement[datetime]) -> ColumnElement[int]:
        return func.sum(Order.amount).filter(Order.subscription_id.is_(None))


class NewSubscriptionsMetric(Metric):
    slug = "new_subscriptions"
    display_name = "New Subscriptions"
    type = MetricType.scalar

    @classmethod
    def get_sql_expression(cls, t: ColumnElement[datetime]) -> ColumnElement[int]:
        return func.count(Subscription.id).filter(
            func.date_trunc("day", Subscription.started_at) == func.date_trunc("day", t)
        )


class NewSubscriptionsRevenueMetric(Metric):
    slug = "new_subscriptions_revenue"
    display_name = "New Subscriptions Revenue"
    type = MetricType.currency

    @classmethod
    def get_sql_expression(cls, t: ColumnElement[datetime]) -> ColumnElement[int]:
        return func.sum(Order.amount).filter(
            func.date_trunc("day", Subscription.started_at) == func.date_trunc("day", t)
        )


class RenewedSubscriptionsMetric(Metric):
    slug = "renewed_subscriptions"
    display_name = "Renewed Subscriptions"
    type = MetricType.scalar

    @classmethod
    def get_sql_expression(cls, t: ColumnElement[datetime]) -> ColumnElement[int]:
        return func.count(Subscription.id).filter(
            func.date_trunc("day", Subscription.started_at) != func.date_trunc("day", t)
        )


class RenewedSubscriptionsRevenueMetric(Metric):
    slug = "renewed_subscriptions_revenue"
    display_name = "Renewed Subscriptions Revenue"
    type = MetricType.currency

    @classmethod
    def get_sql_expression(cls, t: ColumnElement[datetime]) -> ColumnElement[int]:
        return func.sum(Order.amount).filter(
            func.date_trunc("day", Subscription.started_at) != func.date_trunc("day", t)
        )


METRICS: list[type[Metric]] = [
    OrdersMetric,
    RevenueMetric,
    AverageOrderValueMetric,
    OneTimeProductsMetric,
    OneTimeProductsRevenueMetric,
    NewSubscriptionsMetric,
    NewSubscriptionsRevenueMetric,
    RenewedSubscriptionsMetric,
    RenewedSubscriptionsRevenueMetric,
]

__all__ = ["MetricType", "METRICS"]
