from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from polar.models.billing_interval import UsagePolicy


@dataclass(frozen=True)
class SubscriptionMeterBillingState:
    """Links a meter with a price and an usage policy."""

    meter_id: UUID
    product_price_id: UUID
    usage_policy: UsagePolicy


@dataclass(frozen=True)
class MeterCharge:
    """A meter's usage to charge by price, oldest price first, and its credits.
    `period_shares` is the share of the billed period each price is charged for."""

    units_by_price: dict[UUID, Decimal]
    period_shares: dict[UUID, Decimal]
    credited_units: Decimal


@dataclass(frozen=True)
class IntervalChangePlan:
    effective_at: datetime
    close_interval_ids: tuple[UUID, ...] = ()
    new_interval_states: tuple[SubscriptionMeterBillingState, ...] = ()
