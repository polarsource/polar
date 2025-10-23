from collections import deque
from collections.abc import Iterable
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, ClassVar, Protocol, cast

if TYPE_CHECKING:
    from .schemas import MetricsPeriod

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


def cumulative_sum(periods: Iterable["MetricsPeriod"], slug: str) -> int | float:
    return sum(getattr(p, slug) for p in periods)


def cumulative_last(periods: Iterable["MetricsPeriod"], slug: str) -> int | float:
    dd = deque((getattr(p, slug) for p in periods), maxlen=1)
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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float: ...


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_last(periods, cls.slug)


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_last(periods, cls.slug)


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> float:
        total_orders = sum(getattr(p, "orders") for p in periods)
        revenue = sum(getattr(p, "revenue") for p in periods)
        return revenue / total_orders if total_orders > 0 else 0.0


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> float:
        total_orders = sum(getattr(p, "orders") for p in periods)
        revenue = sum(getattr(p, "net_revenue") for p in periods)
        return revenue / total_orders if total_orders > 0 else 0.0


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_last(periods, cls.slug)


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_last(periods, cls.slug)


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_last(periods, cls.slug)


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> float:
        total_checkouts = sum(getattr(p, "checkouts") for p in periods)
        total_succeeded = sum(getattr(p, "succeeded_checkouts") for p in periods)
        return total_succeeded / total_checkouts if total_checkouts > 0 else 0.0


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


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
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


class CostsMetric(Metric):
    slug = "costs"
    display_name = "Costs"
    type = MetricType.currency
    query = MetricQuery.costs

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.sum(Event.user_metadata["_cost"]["amount"].as_integer())

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


class CumulativeCostsMetric(Metric):
    slug = "cumulative_costs"
    display_name = "Cumulative Costs"
    type = MetricType.currency
    query = MetricQuery.cumulative_costs

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.sum(Event.user_metadata["_cost"]["amount"].as_integer())

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_last(periods, cls.slug)


METRICS: list[type[Metric]] = [
    OrdersMetric,
    RevenueMetric,
    NetRevenueMetric,
    CumulativeRevenueMetric,
    NetCumulativeRevenueMetric,
    CostsMetric,
    CumulativeCostsMetric,
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
