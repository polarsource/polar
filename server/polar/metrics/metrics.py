import statistics
from collections import deque
from collections.abc import Callable, Iterable
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
    or_,
    type_coerce,
)

from polar.enums import SubscriptionRecurringInterval
from polar.kit.time_queries import TimeInterval
from polar.models import Checkout, Order, Subscription
from polar.models.checkout import CheckoutStatus
from polar.models.event import Event
from polar.models.subscription import CustomerCancellationReason

from .queries import MetricQuery


class MetricType(StrEnum):
    scalar = "scalar"
    currency = "currency"
    percentage = "percentage"


CumulativeFunction = Callable[[Iterable[int | float]], int | float]


def last(values: Iterable[int | float]) -> int | float:
    dd = deque(values, maxlen=1)
    return dd.pop()


class Metric(Protocol):
    slug: ClassVar[str]
    display_name: ClassVar[str]
    type: ClassVar[MetricType]
    query: ClassVar[MetricQuery]

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int] | ColumnElement[float]: ...

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction: ...


class OrdersMetric(Metric):
    slug = "orders"
    display_name = "Orders"
    type = MetricType.scalar
    query = MetricQuery.orders

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.count(Order.id)

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return sum


class RevenueMetric(Metric):
    slug = "revenue"
    display_name = "Revenue"
    type = MetricType.currency
    query = MetricQuery.orders

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.sum(Order.net_amount)

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return sum


class NetRevenueMetric(Metric):
    slug = "net_revenue"
    display_name = "Net Revenue"
    type = MetricType.currency
    query = MetricQuery.orders

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.sum(Order.payout_amount)

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return sum


class CumulativeRevenueMetric(Metric):
    slug = "cumulative_revenue"
    display_name = "Cumulative Revenue"
    type = MetricType.currency
    query = MetricQuery.cumulative_orders

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.sum(Order.net_amount)

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return last


class NetCumulativeRevenueMetric(Metric):
    slug = "net_cumulative_revenue"
    display_name = "Net Cumulative Revenue"
    type = MetricType.currency
    query = MetricQuery.cumulative_orders

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.sum(Order.payout_amount)

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return last


class AverageOrderValueMetric(Metric):
    slug = "average_order_value"
    display_name = "Average Order Value"
    type = MetricType.currency
    query = MetricQuery.orders

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.cast(func.ceil(func.avg(Order.net_amount)), Integer)

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return statistics.fmean


class NetAverageOrderValueMetric(Metric):
    slug = "net_average_order_value"
    display_name = "Net Average Order Value"
    type = MetricType.currency
    query = MetricQuery.orders

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.cast(func.ceil(func.avg(Order.payout_amount)), Integer)

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return statistics.fmean


class OneTimeProductsMetric(Metric):
    slug = "one_time_products"
    display_name = "One-Time Products"
    type = MetricType.scalar
    query = MetricQuery.orders

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.count(Order.id).filter(Order.subscription_id.is_(None))

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return sum


class OneTimeProductsRevenueMetric(Metric):
    slug = "one_time_products_revenue"
    display_name = "One-Time Products Revenue"
    type = MetricType.currency
    query = MetricQuery.orders

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.sum(Order.net_amount).filter(Order.subscription_id.is_(None))

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return sum


class OneTimeProductsNetRevenueMetric(Metric):
    slug = "one_time_products_net_revenue"
    display_name = "One-Time Products Net Revenue"
    type = MetricType.currency
    query = MetricQuery.orders

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.sum(Order.payout_amount).filter(Order.subscription_id.is_(None))

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return sum


class NewSubscriptionsMetric(Metric):
    slug = "new_subscriptions"
    display_name = "New Subscriptions"
    type = MetricType.scalar
    query = MetricQuery.active_subscriptions

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.count(Subscription.id).filter(
            i.sql_date_trunc(
                cast(SQLColumnExpression[datetime], Subscription.started_at)
            )
            == i.sql_date_trunc(t)
        )

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return sum


class NewSubscriptionsRevenueMetric(Metric):
    slug = "new_subscriptions_revenue"
    display_name = "New Subscriptions Revenue"
    type = MetricType.currency
    query = MetricQuery.orders

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.sum(Order.net_amount).filter(
            i.sql_date_trunc(
                cast(SQLColumnExpression[datetime], Subscription.started_at)
            )
            == i.sql_date_trunc(t)
        )

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return sum


class NewSubscriptionsNetRevenueMetric(Metric):
    slug = "new_subscriptions_net_revenue"
    display_name = "New Subscriptions Net Revenue"
    type = MetricType.currency
    query = MetricQuery.orders

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.sum(Order.payout_amount).filter(
            i.sql_date_trunc(
                cast(SQLColumnExpression[datetime], Subscription.started_at)
            )
            == i.sql_date_trunc(t)
        )

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return sum


class RenewedSubscriptionsMetric(Metric):
    slug = "renewed_subscriptions"
    display_name = "Renewed Subscriptions"
    type = MetricType.scalar
    query = MetricQuery.orders

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.count(Subscription.id.distinct()).filter(
            i.sql_date_trunc(
                cast(SQLColumnExpression[datetime], Subscription.started_at)
            )
            != i.sql_date_trunc(t)
        )

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return sum


class RenewedSubscriptionsRevenueMetric(Metric):
    slug = "renewed_subscriptions_revenue"
    display_name = "Renewed Subscriptions Revenue"
    type = MetricType.currency
    query = MetricQuery.orders

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.sum(Order.net_amount).filter(
            i.sql_date_trunc(
                cast(SQLColumnExpression[datetime], Subscription.started_at)
            )
            != i.sql_date_trunc(t)
        )

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return sum


class RenewedSubscriptionsNetRevenueMetric(Metric):
    slug = "renewed_subscriptions_net_revenue"
    display_name = "Renewed Subscriptions Net Revenue"
    type = MetricType.currency
    query = MetricQuery.orders

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.sum(Order.payout_amount).filter(
            i.sql_date_trunc(
                cast(SQLColumnExpression[datetime], Subscription.started_at)
            )
            != i.sql_date_trunc(t)
        )

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return sum


class ActiveSubscriptionsMetric(Metric):
    slug = "active_subscriptions"
    display_name = "Active Subscriptions"
    type = MetricType.scalar
    query = MetricQuery.active_subscriptions

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.count(Subscription.id)

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return last


class MonthlyRecurringRevenueMetric(Metric):
    slug = "monthly_recurring_revenue"
    display_name = "Monthly Recurring Revenue"
    type = MetricType.currency
    query = MetricQuery.active_subscriptions

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
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

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return last


class CommittedMonthlyRecurringRevenueMetric(Metric):
    slug = "committed_monthly_recurring_revenue"
    display_name = "Committed Monthly Recurring Revenue"
    type = MetricType.currency
    query = MetricQuery.active_subscriptions

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
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
            ).filter(
                or_(
                    func.coalesce(Subscription.ended_at, Subscription.ends_at).is_(
                        None
                    ),
                    i.sql_date_trunc(
                        cast(
                            SQLColumnExpression[datetime],
                            func.coalesce(Subscription.ended_at, Subscription.ends_at),
                        )
                    )
                    < i.sql_date_trunc(now),
                )
            ),
            0,
        )

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return last


class CheckoutsMetric(Metric):
    slug = "checkouts"
    display_name = "Checkouts"
    type = MetricType.scalar
    query = MetricQuery.checkouts

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.count(Checkout.id)

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return sum


class SucceededCheckoutsMetric(Metric):
    slug = "succeeded_checkouts"
    display_name = "Succeeded Checkouts"
    type = MetricType.scalar
    query = MetricQuery.checkouts

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.count(Checkout.id).filter(
            Checkout.status == CheckoutStatus.succeeded
        )

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return sum


class CheckoutsConversionMetric(Metric):
    slug = "checkouts_conversion"
    display_name = "Checkouts Conversion Rate"
    type = MetricType.percentage
    query = MetricQuery.checkouts

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[float]:
        return type_coerce(
            case(
                (func.count(Checkout.id) == 0, 0),
                else_=func.count(Checkout.id).filter(
                    Checkout.status == CheckoutStatus.succeeded
                )
                / func.count(Checkout.id),
            ),
            Float,
        )

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return statistics.fmean


class CanceledSubscriptionsMetric(Metric):
    slug = "canceled_subscriptions"
    display_name = "Canceled Subscriptions"
    type = MetricType.scalar
    query = MetricQuery.canceled_subscriptions

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.count(Subscription.id)

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return sum


class CanceledSubscriptionsCustomerServiceMetric(Metric):
    slug = "canceled_subscriptions_customer_service"
    display_name = "Canceled Subscriptions - Customer Service"
    type = MetricType.scalar
    query = MetricQuery.canceled_subscriptions

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.count(Subscription.id).filter(
            Subscription.customer_cancellation_reason
            == CustomerCancellationReason.customer_service
        )

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return sum


class CanceledSubscriptionsLowQualityMetric(Metric):
    slug = "canceled_subscriptions_low_quality"
    display_name = "Canceled Subscriptions - Low Quality"
    type = MetricType.scalar
    query = MetricQuery.canceled_subscriptions

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.count(Subscription.id).filter(
            Subscription.customer_cancellation_reason
            == CustomerCancellationReason.low_quality
        )

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return sum


class CanceledSubscriptionsMissingFeaturesMetric(Metric):
    slug = "canceled_subscriptions_missing_features"
    display_name = "Canceled Subscriptions - Missing Features"
    type = MetricType.scalar
    query = MetricQuery.canceled_subscriptions

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.count(Subscription.id).filter(
            Subscription.customer_cancellation_reason
            == CustomerCancellationReason.missing_features
        )

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return sum


class CanceledSubscriptionsSwitchedServiceMetric(Metric):
    slug = "canceled_subscriptions_switched_service"
    display_name = "Canceled Subscriptions - Switched Service"
    type = MetricType.scalar
    query = MetricQuery.canceled_subscriptions

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.count(Subscription.id).filter(
            Subscription.customer_cancellation_reason
            == CustomerCancellationReason.switched_service
        )

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return sum


class CanceledSubscriptionsTooComplexMetric(Metric):
    slug = "canceled_subscriptions_too_complex"
    display_name = "Canceled Subscriptions - Too Complex"
    type = MetricType.scalar
    query = MetricQuery.canceled_subscriptions

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.count(Subscription.id).filter(
            Subscription.customer_cancellation_reason
            == CustomerCancellationReason.too_complex
        )

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return sum


class CanceledSubscriptionsTooExpensiveMetric(Metric):
    slug = "canceled_subscriptions_too_expensive"
    display_name = "Canceled Subscriptions - Too Expensive"
    type = MetricType.scalar
    query = MetricQuery.canceled_subscriptions

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.count(Subscription.id).filter(
            Subscription.customer_cancellation_reason
            == CustomerCancellationReason.too_expensive
        )

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return sum


class CanceledSubscriptionsUnusedMetric(Metric):
    slug = "canceled_subscriptions_unused"
    display_name = "Canceled Subscriptions - Unused"
    type = MetricType.scalar
    query = MetricQuery.canceled_subscriptions

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.count(Subscription.id).filter(
            Subscription.customer_cancellation_reason
            == CustomerCancellationReason.unused
        )

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return sum


class CanceledSubscriptionsOtherMetric(Metric):
    slug = "canceled_subscriptions_other"
    display_name = "Canceled Subscriptions - Other"
    type = MetricType.scalar
    query = MetricQuery.canceled_subscriptions

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.count(Subscription.id).filter(
            Subscription.customer_cancellation_reason
            == CustomerCancellationReason.other
        )

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return sum


class CostsMetric(Metric):
    slug = "costs"
    display_name = "Costs"
    type = MetricType.currency
    query = MetricQuery.costs

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.sum(Event.cost["cost"].as_integer())

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return sum


class CumulativeCostsMetric(Metric):
    slug = "cumulative_costs"
    display_name = "Cumulative Costs"
    type = MetricType.currency
    query = MetricQuery.cumulative_costs

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.sum(Event.cost["cost"].as_integer())

    @classmethod
    def get_cumulative_function(cls) -> CumulativeFunction:
        return last


METRICS: list[type[Metric]] = [
    OrdersMetric,
    RevenueMetric,
    NetRevenueMetric,
    CostsMetric,
    CumulativeCostsMetric,
    CumulativeRevenueMetric,
    NetCumulativeRevenueMetric,
    AverageOrderValueMetric,
    NetAverageOrderValueMetric,
    OneTimeProductsMetric,
    OneTimeProductsRevenueMetric,
    OneTimeProductsNetRevenueMetric,
    NewSubscriptionsMetric,
    NewSubscriptionsRevenueMetric,
    NewSubscriptionsNetRevenueMetric,
    RenewedSubscriptionsMetric,
    RenewedSubscriptionsRevenueMetric,
    RenewedSubscriptionsNetRevenueMetric,
    ActiveSubscriptionsMetric,
    MonthlyRecurringRevenueMetric,
    CommittedMonthlyRecurringRevenueMetric,
    CheckoutsMetric,
    SucceededCheckoutsMetric,
    CheckoutsConversionMetric,
    CanceledSubscriptionsMetric,
    CanceledSubscriptionsCustomerServiceMetric,
    CanceledSubscriptionsLowQualityMetric,
    CanceledSubscriptionsMissingFeaturesMetric,
    CanceledSubscriptionsSwitchedServiceMetric,
    CanceledSubscriptionsTooComplexMetric,
    CanceledSubscriptionsTooExpensiveMetric,
    CanceledSubscriptionsUnusedMetric,
    CanceledSubscriptionsOtherMetric,
]

__all__ = ["MetricType", "Metric", "METRICS"]
