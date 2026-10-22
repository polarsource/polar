from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from polar.billing_entry.types import PendingByMeter, PendingByPrice
from polar.models.billing_interval import UsagePolicy
from polar.models.order import OrderBillingReasonInternal
from polar.reducer.types import UsageWindow


@dataclass(frozen=True)
class SubscriptionMeterBillingState:
    """Links a meter with a price and an usage policy."""

    meter_id: UUID
    product_price_id: UUID
    usage_policy: UsagePolicy


@dataclass(frozen=True)
class IntervalChangePlan:
    """Discard intervals that would start and end at the same time.

    Only intervals created in this transaction may be discarded.
    """

    effective_at: datetime
    close_interval_ids: tuple[UUID, ...] = ()
    discard_interval_ids: tuple[UUID, ...] = ()
    new_interval_states: tuple[SubscriptionMeterBillingState, ...] = ()


@dataclass(frozen=True)
class FixedDiscountTerms:
    discount_id: UUID
    currency: str
    amount: int
    type: Literal["fixed"] = "fixed"


@dataclass(frozen=True)
class PercentageDiscountTerms:
    discount_id: UUID
    basis_points: int
    type: Literal["percentage"] = "percentage"


type DiscountTerms = FixedDiscountTerms | PercentageDiscountTerms


@dataclass(frozen=True)
class LegacyUsage:
    meter_id: UUID
    product_price_id: UUID
    scope: PendingByPrice | PendingByMeter
    consumed_units: Decimal


@dataclass(frozen=True)
class MeteredSettlement:
    """A successful legacy calculation; an empty legacy_usage is verified empty."""

    organization_id: UUID
    billing_subscription_id: UUID
    customer_id: UUID
    cutoff: datetime
    currency: str
    billing_reason: OrderBillingReasonInternal
    selected_price_ids: tuple[UUID, ...]
    discount_terms: DiscountTerms | None
    legacy_usage: tuple[LegacyUsage, ...]
    order_id: UUID | None
    kind: Literal["settlement"] = "settlement"


@dataclass(frozen=True)
class UsageDiagnostic:
    organization_id: UUID
    subscription_id: UUID
    customer_id: UUID
    cutoff: datetime
    kind: Literal["diagnostic"] = "diagnostic"


@dataclass(frozen=True)
class PricedUsageWindow:
    window: UsageWindow
    product_price_id: UUID
    currency: str


@dataclass(frozen=True)
class SettlementWindowSelection:
    claim_windows: tuple[UsageWindow, ...]
    deferred_windows: tuple[UsageWindow, ...]


@dataclass(frozen=True)
class SettlementPlan:
    windows: tuple[PricedUsageWindow, ...]
    selection: SettlementWindowSelection
