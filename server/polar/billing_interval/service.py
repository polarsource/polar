"""Interface declarations only; lifecycle and comparison execution are unimplemented."""

from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Protocol
from uuid import UUID

from polar.models import BillingInterval, Meter, Subscription
from polar.postgres import AsyncSession
from polar.reducer.types import UsageWindow

from .comparison import BillingComparison
from .types import (
    IntervalChangePlan,
    MeteredSettlement,
    SettlementWindowSelection,
    SubscriptionMeterBillingState,
    UsageDiagnostic,
)


class BillingIntervalService(Protocol):
    async def record_subscription(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        effective_at: datetime,
    ) -> None:
        """Reconcile terms and split changed endpoints in the caller's transaction."""
        ...

    async def record_meter(
        self,
        session: AsyncSession,
        meter: Meter,
        *,
        effective_at: datetime,
    ) -> None:
        """Reconcile availability for the prelocked affected subscription set."""
        ...

    async def compare(
        self,
        session: AsyncSession,
        settlement: MeteredSettlement | UsageDiagnostic,
    ) -> BillingComparison:
        """Capture a request; execution starts in a fresh task transaction."""
        ...


def derive_meter_billing_states(
    subscription: Subscription, meters: Mapping[UUID, Meter]
) -> tuple[SubscriptionMeterBillingState, ...]:
    raise NotImplementedError


def plan_interval_changes(
    intervals: Sequence[BillingInterval],
    desired_states: Sequence[SubscriptionMeterBillingState],
    *,
    effective_at: datetime,
) -> IntervalChangePlan:
    """Preserve committed history; collapse same-transaction changes at one boundary."""
    raise NotImplementedError


def resolve_ownership(
    intervals: Sequence[BillingInterval],
    subscription_starts: Mapping[UUID, datetime | None],
    *,
    cutoff: datetime,
) -> tuple[UsageWindow, ...]:
    """Select owners before excluding usage won by trial or paused intervals."""
    raise NotImplementedError


def select_settlement_windows(
    windows: Sequence[UsageWindow],
    intervals: Sequence[BillingInterval],
    subscription_starts: Mapping[UUID, datetime | None],
    price_currencies: Mapping[UUID, str],
    *,
    settlement: MeteredSettlement | UsageDiagnostic,
) -> SettlementWindowSelection:
    """Select claims and deferred history without consulting current subscription state."""
    raise NotImplementedError
