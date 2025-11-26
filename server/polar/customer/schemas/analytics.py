from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from pydantic import UUID4, AwareDatetime, Field

from polar.enums import SubscriptionRecurringInterval
from polar.kit.schemas import Schema
from polar.models.subscription import SubscriptionStatus

if TYPE_CHECKING:
    from polar.models import Customer, Subscription


@dataclass
class CustomerWithMetrics:
    customer: "Customer"
    subscription: "Subscription | None"
    lifetime_revenue: int
    lifetime_cost: int
    profit: int
    margin_percent: Decimal


@dataclass
class CustomerCostTimeseries:
    timestamp: datetime
    cost: Decimal
    revenue: Decimal


class CustomerSubscription(Schema):
    id: UUID4 = Field(description="The subscription ID.")
    status: SubscriptionStatus = Field(description="The subscription status.")
    amount: int = Field(description="The subscription amount in cents.")
    currency: str = Field(description="The subscription currency.")
    recurring_interval: SubscriptionRecurringInterval = Field(
        description="The subscription recurring interval."
    )


class CustomerMetricPeriod(Schema):
    timestamp: AwareDatetime = Field(description="Period timestamp.")
    cost: Decimal = Field(description="Total cost for this period.")
    revenue: Decimal = Field(description="Total revenue for this period.")
    profit: Decimal = Field(description="Profit for this period (revenue - cost).")


class CustomerMetrics(Schema):
    customer_id: UUID4 = Field(description="The customer ID.")
    customer_name: str | None = Field(description="The customer name.")
    customer_email: str = Field(description="The customer email.")
    subscription: CustomerSubscription | None = Field(
        default=None, description="The customer's active subscription, if any."
    )
    lifetime_revenue: int = Field(
        description="Total lifetime revenue from this customer in cents."
    )
    lifetime_cost: int = Field(
        description="Total lifetime cost attributed to this customer in cents."
    )
    profit: int = Field(description="Lifetime profit (revenue - cost) in cents.")
    margin_percent: Decimal = Field(description="Profit margin percentage.")
    periods: list[CustomerMetricPeriod] = Field(
        default_factory=list,
        description="Cost/revenue breakdown by time period for sparklines.",
    )


class CustomerAnalytics(Schema):
    customers: list[CustomerMetrics] = Field(
        description="List of customers with their cost metrics."
    )
