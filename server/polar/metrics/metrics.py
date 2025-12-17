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
    currency_sub_cent = "currency_sub_cent"
    percentage = "percentage"


def cumulative_sum(periods: Iterable["MetricsPeriod"], slug: str) -> int | float:
    return sum(getattr(p, slug) or 0 for p in periods)


def cumulative_last(periods: Iterable["MetricsPeriod"], slug: str) -> int | float:
    dd = deque((getattr(p, slug) for p in periods), maxlen=1)
    value = dd.pop()
    return value if value is not None else 0


class Metric(Protocol):
    slug: ClassVar[str]
    display_name: ClassVar[str]
    type: ClassVar[MetricType]

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float: ...


class SQLMetric(Metric, Protocol):
    query: ClassVar[MetricQuery]

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int] | ColumnElement[float]: ...


class MetaMetric(Metric, Protocol):
    @classmethod
    def compute_from_period(cls, period: "MetricsPeriod") -> int | float: ...


class OrdersMetric(SQLMetric):
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


class RevenueMetric(SQLMetric):
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


class NetRevenueMetric(SQLMetric):
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


class CumulativeRevenueMetric(SQLMetric):
    slug = "cumulative_revenue"
    display_name = "Cumulative Revenue"
    type = MetricType.currency
    query = MetricQuery.orders

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.sum(Order.net_amount)

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_last(periods, cls.slug)


class NetCumulativeRevenueMetric(SQLMetric):
    slug = "net_cumulative_revenue"
    display_name = "Net Cumulative Revenue"
    type = MetricType.currency
    query = MetricQuery.orders

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.sum(Order.payout_amount)

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_last(periods, cls.slug)


class AverageOrderValueMetric(SQLMetric):
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
        total_orders = sum(getattr(p, "orders") or 0 for p in periods)
        revenue = sum(getattr(p, "revenue") or 0 for p in periods)
        return revenue / total_orders if total_orders > 0 else 0.0


class NetAverageOrderValueMetric(SQLMetric):
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
        total_orders = sum(getattr(p, "orders") or 0 for p in periods)
        revenue = sum(getattr(p, "net_revenue") or 0 for p in periods)
        return revenue / total_orders if total_orders > 0 else 0.0


class OneTimeProductsMetric(SQLMetric):
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


class OneTimeProductsRevenueMetric(SQLMetric):
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


class OneTimeProductsNetRevenueMetric(SQLMetric):
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


class NewSubscriptionsMetric(SQLMetric):
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


class NewSubscriptionsRevenueMetric(SQLMetric):
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


class NewSubscriptionsNetRevenueMetric(SQLMetric):
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


class RenewedSubscriptionsMetric(SQLMetric):
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


class RenewedSubscriptionsRevenueMetric(SQLMetric):
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


class RenewedSubscriptionsNetRevenueMetric(SQLMetric):
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


class ActiveSubscriptionsMetric(SQLMetric):
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


class CommittedSubscriptionsMetric(SQLMetric):
    slug = "committed_subscriptions"
    display_name = "Committed Subscriptions"
    type = MetricType.scalar
    query = MetricQuery.active_subscriptions

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.count(Subscription.id).filter(
            or_(
                func.coalesce(Subscription.ended_at, Subscription.ends_at).is_(None),
                i.sql_date_trunc(
                    cast(
                        SQLColumnExpression[datetime],
                        func.coalesce(Subscription.ended_at, Subscription.ends_at),
                    )
                )
                < i.sql_date_trunc(now),
            )
        )

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_last(periods, cls.slug)


class MonthlyRecurringRevenueMetric(SQLMetric):
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
                    (
                        Subscription.recurring_interval
                        == SubscriptionRecurringInterval.week,
                        func.round(Subscription.amount * 4),
                    ),
                    (
                        Subscription.recurring_interval
                        == SubscriptionRecurringInterval.day,
                        func.round(Subscription.amount * 30),
                    ),
                )
            ),
            0,
        )

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_last(periods, cls.slug)


class CommittedMonthlyRecurringRevenueMetric(SQLMetric):
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
                    (
                        Subscription.recurring_interval
                        == SubscriptionRecurringInterval.week,
                        func.round(Subscription.amount * 4),
                    ),
                    (
                        Subscription.recurring_interval
                        == SubscriptionRecurringInterval.day,
                        func.round(Subscription.amount * 30),
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


class CheckoutsMetric(SQLMetric):
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


class SucceededCheckoutsMetric(SQLMetric):
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


class CheckoutsConversionMetric(SQLMetric):
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
        total_checkouts = sum(getattr(p, "checkouts") or 0 for p in periods)
        total_succeeded = sum(getattr(p, "succeeded_checkouts") or 0 for p in periods)
        return total_succeeded / total_checkouts if total_checkouts > 0 else 0.0


class CanceledSubscriptionsMetric(SQLMetric):
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


class CanceledSubscriptionsCustomerServiceMetric(SQLMetric):
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


class CanceledSubscriptionsLowQualityMetric(SQLMetric):
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


class CanceledSubscriptionsMissingFeaturesMetric(SQLMetric):
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


class CanceledSubscriptionsSwitchedServiceMetric(SQLMetric):
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


class CanceledSubscriptionsTooComplexMetric(SQLMetric):
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


class CanceledSubscriptionsTooExpensiveMetric(SQLMetric):
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


class CanceledSubscriptionsUnusedMetric(SQLMetric):
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


class CanceledSubscriptionsOtherMetric(SQLMetric):
    slug = "canceled_subscriptions_other"
    display_name = "Canceled Subscriptions - Other"
    type = MetricType.scalar
    query = MetricQuery.canceled_subscriptions

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.count(Subscription.id).filter(
            or_(
                Subscription.customer_cancellation_reason
                == CustomerCancellationReason.other,
                Subscription.customer_cancellation_reason.is_(None),
            )
        )

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


class ChurnedSubscriptionsMetric(SQLMetric):
    slug = "churned_subscriptions"
    display_name = "Churned Subscriptions"
    type = MetricType.scalar
    query = MetricQuery.churned_subscriptions

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.count(Subscription.id)

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


class CostsMetric(SQLMetric):
    slug = "costs"
    display_name = "Costs"
    type = MetricType.currency_sub_cent
    query = MetricQuery.events

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.sum(
            Event.user_metadata["_cost"]["amount"].as_numeric(17, 12)
        ).filter(Event.user_metadata["_cost"].is_not(None))

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


class CumulativeCostsMetric(SQLMetric):
    slug = "cumulative_costs"
    display_name = "Cumulative Costs"
    type = MetricType.currency_sub_cent
    query = MetricQuery.events

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.sum(
            Event.user_metadata["_cost"]["amount"].as_numeric(17, 12)
        ).filter(Event.user_metadata["_cost"].is_not(None))

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_last(periods, cls.slug)


class AverageRevenuePerUserMetric(SQLMetric):
    slug = "average_revenue_per_user"
    display_name = "Average Revenue Per User"
    type = MetricType.currency
    query = MetricQuery.active_subscriptions

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.cast(
            case(
                (func.count(Subscription.customer_id.distinct()) == 0, 0),
                else_=func.coalesce(
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
                            (
                                Subscription.recurring_interval
                                == SubscriptionRecurringInterval.week,
                                func.round(Subscription.amount * 4),
                            ),
                            (
                                Subscription.recurring_interval
                                == SubscriptionRecurringInterval.day,
                                func.round(Subscription.amount * 30),
                            ),
                        )
                    ),
                    0,
                )
                / func.count(Subscription.customer_id.distinct()),
            ),
            Integer,
        )

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_last(periods, cls.slug)


class CostPerUserMetric(SQLMetric):
    slug = "cost_per_user"
    display_name = "Cost Per User"
    type = MetricType.currency_sub_cent
    query = MetricQuery.events

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[float]:
        total_customers = func.count(func.distinct(Event.customer_id)) + func.count(
            func.distinct(Event.external_customer_id)
        )

        total_costs = func.sum(
            func.coalesce(Event.user_metadata["_cost"]["amount"].as_numeric(17, 12), 0)
        )

        return type_coerce(
            case(
                (total_customers == 0, 0),
                else_=total_costs / total_customers,
            ),
            Float,
        )

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> float:
        total_active_users = cumulative_last(periods, ActiveSubscriptionsMetric.slug)
        total_costs = sum(getattr(p, CostsMetric.slug) or 0 for p in periods)
        return total_costs / total_active_users if total_active_users > 0 else 0.0


class GrossMarginMetric(MetaMetric):
    slug = "gross_margin"
    display_name = "Gross Margin"
    type = MetricType.currency
    dependencies: ClassVar[list[str]] = ["cumulative_revenue", "cumulative_costs"]

    @classmethod
    def compute_from_period(cls, period: "MetricsPeriod") -> float:
        revenue = period.cumulative_revenue or 0
        costs = period.cumulative_costs or 0
        return revenue - costs

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> float:
        return cumulative_last(periods, cls.slug)


class GrossMarginPercentageMetric(MetaMetric):
    slug = "gross_margin_percentage"
    display_name = "Gross Margin %"
    type = MetricType.percentage
    dependencies: ClassVar[list[str]] = ["cumulative_revenue", "cumulative_costs"]

    @classmethod
    def compute_from_period(cls, period: "MetricsPeriod") -> float:
        revenue = period.cumulative_revenue or 0
        costs = period.cumulative_costs or 0
        return (revenue - costs) / revenue if revenue > 0 else 0.0

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> float:
        return cumulative_last(periods, cls.slug)


class CashflowMetric(MetaMetric):
    slug = "cashflow"
    display_name = "Cashflow"
    type = MetricType.currency
    dependencies: ClassVar[list[str]] = ["revenue", "costs"]

    @classmethod
    def compute_from_period(cls, period: "MetricsPeriod") -> float:
        revenue = period.revenue or 0
        costs = period.costs or 0
        return revenue - costs

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> float:
        return cumulative_sum(periods, cls.slug)


class ChurnRateMetric(MetaMetric):
    slug = "churn_rate"
    display_name = "Churn Rate"
    type = MetricType.percentage
    dependencies: ClassVar[list[str]] = [
        "active_subscriptions",
        "new_subscriptions",
        "churned_subscriptions",
        "canceled_subscriptions",
    ]

    @classmethod
    def compute_from_period(cls, period: "MetricsPeriod") -> float:
        active_during = period.active_subscriptions or 0
        new = period.new_subscriptions or 0
        churned = period.churned_subscriptions or 0
        canceled = period.canceled_subscriptions or 0
        active_at_start = active_during - new + churned
        return canceled / active_at_start if active_at_start > 0 else 0.0

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> float:
        return cumulative_last(periods, cls.slug)


class LTVMetric(MetaMetric):
    slug = "ltv"
    display_name = "Lifetime Value"
    type = MetricType.currency
    dependencies: ClassVar[list[str]] = [
        "average_revenue_per_user",
        "cost_per_user",
        "churn_rate",
    ]

    @classmethod
    def compute_from_period(cls, period: "MetricsPeriod") -> int:
        arpu = period.average_revenue_per_user or 0
        cost_per_user = period.cost_per_user or 0
        churn_rate = period.churn_rate or 0

        if churn_rate == 0:
            return 0

        net_revenue_per_user = arpu - cost_per_user
        ltv = int(net_revenue_per_user / churn_rate)

        return max(0, ltv)

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int:
        return int(cumulative_last(periods, cls.slug))


class ActiveUserMetric(SQLMetric):
    slug = "active_user_by_event"
    display_name = "Active User (By event)"
    type = MetricType.scalar
    query = MetricQuery.events

    @classmethod
    def get_sql_expression(
        cls, t: ColumnElement[datetime], i: TimeInterval, now: datetime
    ) -> ColumnElement[int]:
        return func.count(func.distinct(Event.customer_id)) + func.count(
            func.distinct(Event.external_customer_id)
        )

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int:
        return int(cumulative_last(periods, ActiveSubscriptionsMetric.slug))


METRICS_SQL: list[type[SQLMetric]] = [
    OrdersMetric,
    RevenueMetric,
    NetRevenueMetric,
    CumulativeRevenueMetric,
    NetCumulativeRevenueMetric,
    CostsMetric,
    CumulativeCostsMetric,
    AverageOrderValueMetric,
    NetAverageOrderValueMetric,
    AverageRevenuePerUserMetric,
    CostPerUserMetric,
    ActiveUserMetric,
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
    CommittedSubscriptionsMetric,
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
    ChurnedSubscriptionsMetric,
]

METRICS_POST_COMPUTE: list[type[MetaMetric]] = [
    ChurnRateMetric,
    LTVMetric,
    GrossMarginMetric,
    GrossMarginPercentageMetric,
    CashflowMetric,
]

METRICS: list[type[Metric]] = [
    *METRICS_SQL,
    *METRICS_POST_COMPUTE,
]

__all__ = [
    "METRICS",
    "METRICS_POST_COMPUTE",
    "METRICS_SQL",
    "MetaMetric",
    "Metric",
    "MetricType",
    "SQLMetric",
]
