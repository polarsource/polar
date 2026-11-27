from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from polar.models import BillingInterval
from polar.models.billing_interval import UsagePolicy


@dataclass(frozen=True)
class SubscriptionMeterBillingState:
    """Links a meter with a price and an usage policy."""

    meter_id: UUID
    product_price_id: UUID
    usage_policy: UsagePolicy


@dataclass(frozen=True)
class MeterCharge:
    """A meter's usage to charge, in total and by price, oldest price first,
    and its credits. `period_shares` is the share of the billed period each price
    is charged for."""

    units: Decimal
    units_by_price: dict[UUID, Decimal]
    period_shares: dict[UUID, Decimal]
    credited_units: Decimal


class BillingIntervalGenerationStatus(StrEnum):
    open = "open"
    unbilled = "unbilled"
    billed = "billed"
    not_charged = "not_charged"


@dataclass(frozen=True)
class IntervalGeneration:
    generation: int
    order_id: UUID | None
    units: Decimal
    amount: int
    status: BillingIntervalGenerationStatus


@dataclass(frozen=True)
class IntervalUsageGroup:
    period_start: datetime
    period_end: datetime
    units: Decimal
    credited_units: Decimal
    amount: int
    generations: tuple[IntervalGeneration, ...]


@dataclass(frozen=True)
class IntervalUsage:
    interval: BillingInterval
    groups: tuple[IntervalUsageGroup, ...]


@dataclass(frozen=True)
class IntervalChangePlan:
    effective_at: datetime
    close_interval_ids: tuple[UUID, ...] = ()
    new_interval_states: tuple[SubscriptionMeterBillingState, ...] = ()
