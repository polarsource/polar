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
from polar.models import Checkout, Subscription
from polar.models.checkout import CheckoutStatus

from .queries import MetricQuery
from .queries_tinybird import TinybirdQuery


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


class TinybirdMetric(Metric, Protocol):
    query: ClassVar[TinybirdQuery]

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float: ...


class MetaMetric(Metric, Protocol):
    @classmethod
    def compute_from_period(cls, period: "MetricsPeriod") -> int | float: ...


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
                        func.round(
                            Subscription.amount
                            / (12 * Subscription.recurring_interval_count)
                        ),
                    ),
                    (
                        Subscription.recurring_interval
                        == SubscriptionRecurringInterval.month,
                        func.round(
                            Subscription.amount / Subscription.recurring_interval_count
                        ),
                    ),
                    (
                        Subscription.recurring_interval
                        == SubscriptionRecurringInterval.week,
                        func.round(
                            Subscription.amount
                            * 52
                            / (12 * Subscription.recurring_interval_count)
                        ),
                    ),
                    (
                        Subscription.recurring_interval
                        == SubscriptionRecurringInterval.day,
                        func.round(
                            Subscription.amount
                            * 365
                            / (12 * Subscription.recurring_interval_count)
                        ),
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
                        func.round(
                            Subscription.amount
                            / (12 * Subscription.recurring_interval_count)
                        ),
                    ),
                    (
                        Subscription.recurring_interval
                        == SubscriptionRecurringInterval.month,
                        func.round(
                            Subscription.amount / Subscription.recurring_interval_count
                        ),
                    ),
                    (
                        Subscription.recurring_interval
                        == SubscriptionRecurringInterval.week,
                        func.round(
                            Subscription.amount
                            * 52
                            / (12 * Subscription.recurring_interval_count)
                        ),
                    ),
                    (
                        Subscription.recurring_interval
                        == SubscriptionRecurringInterval.day,
                        func.round(
                            Subscription.amount
                            * 365
                            / (12 * Subscription.recurring_interval_count)
                        ),
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
                                func.round(
                                    Subscription.amount
                                    / (12 * Subscription.recurring_interval_count)
                                ),
                            ),
                            (
                                Subscription.recurring_interval
                                == SubscriptionRecurringInterval.month,
                                func.round(
                                    Subscription.amount
                                    / Subscription.recurring_interval_count
                                ),
                            ),
                            (
                                Subscription.recurring_interval
                                == SubscriptionRecurringInterval.week,
                                func.round(
                                    Subscription.amount
                                    * 52
                                    / (12 * Subscription.recurring_interval_count)
                                ),
                            ),
                            (
                                Subscription.recurring_interval
                                == SubscriptionRecurringInterval.day,
                                func.round(
                                    Subscription.amount
                                    * 365
                                    / (12 * Subscription.recurring_interval_count)
                                ),
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


class OrdersMetric(TinybirdMetric):
    slug = "orders"
    display_name = "Orders"
    type = MetricType.scalar
    query = TinybirdQuery.events

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


class RevenueMetric(TinybirdMetric):
    slug = "revenue"
    display_name = "Revenue"
    type = MetricType.currency
    query = TinybirdQuery.revenue

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


class NetRevenueMetric(TinybirdMetric):
    slug = "net_revenue"
    display_name = "Net Revenue"
    type = MetricType.currency
    query = TinybirdQuery.revenue

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


class CumulativeRevenueMetric(TinybirdMetric):
    slug = "cumulative_revenue"
    display_name = "Cumulative Revenue"
    type = MetricType.currency
    query = TinybirdQuery.revenue

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_last(periods, cls.slug)


class NetCumulativeRevenueMetric(TinybirdMetric):
    slug = "net_cumulative_revenue"
    display_name = "Net Cumulative Revenue"
    type = MetricType.currency
    query = TinybirdQuery.revenue

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_last(periods, cls.slug)


class AverageOrderValueMetric(TinybirdMetric):
    slug = "average_order_value"
    display_name = "Average Order Value"
    type = MetricType.currency
    query = TinybirdQuery.events

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> float:
        total_orders = sum(getattr(p, "orders") or 0 for p in periods)
        revenue = sum(getattr(p, "revenue") or 0 for p in periods)
        return revenue / total_orders if total_orders > 0 else 0.0


class NetAverageOrderValueMetric(TinybirdMetric):
    slug = "net_average_order_value"
    display_name = "Net Average Order Value"
    type = MetricType.currency
    query = TinybirdQuery.events

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> float:
        total_orders = sum(getattr(p, "orders") or 0 for p in periods)
        revenue = sum(getattr(p, "net_revenue") or 0 for p in periods)
        return revenue / total_orders if total_orders > 0 else 0.0


class OneTimeProductsMetric(TinybirdMetric):
    slug = "one_time_products"
    display_name = "One-Time Products"
    type = MetricType.scalar
    query = TinybirdQuery.events

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


class OneTimeProductsRevenueMetric(TinybirdMetric):
    slug = "one_time_products_revenue"
    display_name = "One-Time Products Revenue"
    type = MetricType.currency
    query = TinybirdQuery.events

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


class OneTimeProductsNetRevenueMetric(TinybirdMetric):
    slug = "one_time_products_net_revenue"
    display_name = "One-Time Products Net Revenue"
    type = MetricType.currency
    query = TinybirdQuery.events

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


class NewSubscriptionsMetric(TinybirdMetric):
    slug = "new_subscriptions"
    display_name = "New Subscriptions"
    type = MetricType.scalar
    query = TinybirdQuery.events

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


class NewSubscriptionsRevenueMetric(TinybirdMetric):
    slug = "new_subscriptions_revenue"
    display_name = "New Subscriptions Revenue"
    type = MetricType.currency
    query = TinybirdQuery.events

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


class NewSubscriptionsNetRevenueMetric(TinybirdMetric):
    slug = "new_subscriptions_net_revenue"
    display_name = "New Subscriptions Net Revenue"
    type = MetricType.currency
    query = TinybirdQuery.events

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


class RenewedSubscriptionsMetric(TinybirdMetric):
    slug = "renewed_subscriptions"
    display_name = "Renewed Subscriptions"
    type = MetricType.scalar
    query = TinybirdQuery.events

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


class RenewedSubscriptionsRevenueMetric(TinybirdMetric):
    slug = "renewed_subscriptions_revenue"
    display_name = "Renewed Subscriptions Revenue"
    type = MetricType.currency
    query = TinybirdQuery.events

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


class RenewedSubscriptionsNetRevenueMetric(TinybirdMetric):
    slug = "renewed_subscriptions_net_revenue"
    display_name = "Renewed Subscriptions Net Revenue"
    type = MetricType.currency
    query = TinybirdQuery.events

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


class CostsMetric(TinybirdMetric):
    slug = "costs"
    display_name = "Costs"
    type = MetricType.currency_sub_cent
    query = TinybirdQuery.costs

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


class CumulativeCostsMetric(TinybirdMetric):
    slug = "cumulative_costs"
    display_name = "Cumulative Costs"
    type = MetricType.currency_sub_cent
    query = TinybirdQuery.costs

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_last(periods, cls.slug)


class ActiveUserMetric(TinybirdMetric):
    slug = "active_user_by_event"
    display_name = "Active User (By event)"
    type = MetricType.scalar
    query = TinybirdQuery.costs

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int:
        return int(cumulative_last(periods, ActiveSubscriptionsMetric.slug))


class CostPerUserMetric(TinybirdMetric):
    slug = "cost_per_user"
    display_name = "Cost Per User"
    type = MetricType.currency_sub_cent
    query = TinybirdQuery.costs

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> float:
        total_active_users = cumulative_last(periods, ActiveSubscriptionsMetric.slug)
        total_costs = sum(getattr(p, CostsMetric.slug) or 0 for p in periods)
        return total_costs / total_active_users if total_active_users > 0 else 0.0


class CanceledSubscriptionsMetric(TinybirdMetric):
    slug = "canceled_subscriptions"
    display_name = "Canceled Subscriptions"
    type = MetricType.scalar
    query = TinybirdQuery.cancellations

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


class CanceledSubscriptionsCustomerServiceMetric(TinybirdMetric):
    slug = "canceled_subscriptions_customer_service"
    display_name = "Canceled Subscriptions - Customer Service"
    type = MetricType.scalar
    query = TinybirdQuery.cancellations

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


class CanceledSubscriptionsLowQualityMetric(TinybirdMetric):
    slug = "canceled_subscriptions_low_quality"
    display_name = "Canceled Subscriptions - Low Quality"
    type = MetricType.scalar
    query = TinybirdQuery.cancellations

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


class CanceledSubscriptionsMissingFeaturesMetric(TinybirdMetric):
    slug = "canceled_subscriptions_missing_features"
    display_name = "Canceled Subscriptions - Missing Features"
    type = MetricType.scalar
    query = TinybirdQuery.cancellations

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


class CanceledSubscriptionsSwitchedServiceMetric(TinybirdMetric):
    slug = "canceled_subscriptions_switched_service"
    display_name = "Canceled Subscriptions - Switched Service"
    type = MetricType.scalar
    query = TinybirdQuery.cancellations

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


class CanceledSubscriptionsTooComplexMetric(TinybirdMetric):
    slug = "canceled_subscriptions_too_complex"
    display_name = "Canceled Subscriptions - Too Complex"
    type = MetricType.scalar
    query = TinybirdQuery.cancellations

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


class CanceledSubscriptionsTooExpensiveMetric(TinybirdMetric):
    slug = "canceled_subscriptions_too_expensive"
    display_name = "Canceled Subscriptions - Too Expensive"
    type = MetricType.scalar
    query = TinybirdQuery.cancellations

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


class CanceledSubscriptionsUnusedMetric(TinybirdMetric):
    slug = "canceled_subscriptions_unused"
    display_name = "Canceled Subscriptions - Unused"
    type = MetricType.scalar
    query = TinybirdQuery.cancellations

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


class CanceledSubscriptionsOtherMetric(TinybirdMetric):
    slug = "canceled_subscriptions_other"
    display_name = "Canceled Subscriptions - Other"
    type = MetricType.scalar
    query = TinybirdQuery.cancellations

    @classmethod
    def get_cumulative(cls, periods: Iterable["MetricsPeriod"]) -> int | float:
        return cumulative_sum(periods, cls.slug)


METRICS_TINYBIRD: list[type[TinybirdMetric]] = [
    OrdersMetric,
    RevenueMetric,
    NetRevenueMetric,
    CumulativeRevenueMetric,
    NetCumulativeRevenueMetric,
    CostsMetric,
    CumulativeCostsMetric,
    AverageOrderValueMetric,
    NetAverageOrderValueMetric,
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


METRICS_POSTGRES: list[type[SQLMetric]] = [
    ActiveSubscriptionsMetric,
    CommittedSubscriptionsMetric,
    MonthlyRecurringRevenueMetric,
    CommittedMonthlyRecurringRevenueMetric,
    AverageRevenuePerUserMetric,
    CheckoutsMetric,
    SucceededCheckoutsMetric,
    CheckoutsConversionMetric,
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
    *METRICS_POSTGRES,
    *METRICS_TINYBIRD,
    *METRICS_POST_COMPUTE,
]

__all__ = [
    "METRICS",
    "METRICS_POSTGRES",
    "METRICS_POST_COMPUTE",
    "METRICS_TINYBIRD",
    "MetaMetric",
    "Metric",
    "MetricType",
    "SQLMetric",
    "TinybirdMetric",
]
