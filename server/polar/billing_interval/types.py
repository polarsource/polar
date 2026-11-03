from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from polar.models.billing_interval import UsagePolicy


@dataclass(frozen=True)
class SubscriptionMeterBillingState:
    """Links a meter with a price and an usage policy."""

    meter_id: UUID
    product_price_id: UUID
    usage_policy: UsagePolicy


@dataclass(frozen=True)
class IntervalChangePlan:
    effective_at: datetime
    close_interval_ids: tuple[UUID, ...] = ()
    new_interval_states: tuple[SubscriptionMeterBillingState, ...] = ()
