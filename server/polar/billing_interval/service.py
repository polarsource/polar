"""Meter availability and comparison execution are unimplemented."""

from collections import defaultdict
from collections.abc import Mapping, Sequence
from datetime import datetime
from itertools import pairwise
from uuid import UUID

import structlog

from polar.exceptions import PolarError
from polar.logging import Logger
from polar.models import BillingInterval, Meter, Subscription
from polar.models.billing_interval import UsagePolicy
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from polar.product.guard import is_metered_price
from polar.reducer.types import UsageWindow

from .comparison import BillingComparison
from .repository import BillingIntervalRepository
from .types import (
    IntervalChangePlan,
    MeteredSettlement,
    SettlementWindowSelection,
    SubscriptionMeterBillingState,
    UsageDiagnostic,
)

log: Logger = structlog.get_logger()

USAGE_POLICIES = {
    SubscriptionStatus.active: UsagePolicy.charge,
    SubscriptionStatus.past_due: UsagePolicy.charge,
    SubscriptionStatus.trialing: UsagePolicy.trial,
    SubscriptionStatus.paused: UsagePolicy.paused,
}


class BillingIntervalConflict(PolarError):
    def __init__(self, message: str) -> None:
        super().__init__(message, 409)


class BillingIntervalService:
    async def record_subscription(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        effective_at: datetime,
    ) -> None:
        """Reconcile terms in the caller's transaction; failures are logged, not raised."""
        try:
            async with session.begin_nested():
                repository = BillingIntervalRepository.from_session(session)
                intervals = await repository.get_by_subscription(subscription.id)
                changes = plan_interval_changes(
                    intervals,
                    derive_meter_billing_states(subscription),
                    effective_at=effective_at,
                )
                await repository.apply_changes(subscription, changes)
        except Exception:
            log.exception(
                "Failed to record billing intervals",
                subscription_id=subscription.id,
                effective_at=effective_at.isoformat(),
            )

    async def record_meter(
        self,
        session: AsyncSession,
        meter: Meter,
        *,
        effective_at: datetime,
    ) -> None:
        """Reconcile availability for the prelocked affected subscription set."""
        raise NotImplementedError

    async def compare(
        self,
        session: AsyncSession,
        settlement: MeteredSettlement | UsageDiagnostic,
    ) -> BillingComparison:
        """Capture a request; execution starts in a fresh task transaction."""
        raise NotImplementedError


def derive_meter_billing_states(
    subscription: Subscription,
) -> tuple[SubscriptionMeterBillingState, ...]:
    usage_policy = USAGE_POLICIES.get(subscription.status)
    if subscription.deleted_at is not None or usage_policy is None:
        return ()

    states: dict[UUID, SubscriptionMeterBillingState] = {}
    for subscription_price in subscription.subscription_product_prices:
        price = subscription_price.product_price
        if not is_metered_price(price):
            continue
        meter = price.meter
        if meter.archived_at is not None or meter.deleted_at is not None:
            continue
        if meter.id in states:
            raise BillingIntervalConflict(
                f"Multiple subscription prices for meter {meter.id}"
            )
        states[meter.id] = SubscriptionMeterBillingState(
            meter.id, price.id, usage_policy
        )
    return tuple(states[meter_id] for meter_id in sorted(states))


def resolve_meter_interval_history(
    intervals: Sequence[BillingInterval], *, effective_at: datetime
) -> tuple[BillingInterval | None, BillingInterval | None]:
    """Return the interval covering `effective_at` and the latest one."""
    history = sorted(intervals, key=lambda interval: interval.period_start)
    for previous, following in pairwise(history):
        if previous.period_end is None or previous.period_end > following.period_start:
            raise BillingIntervalConflict(
                f"Overlapping history for meter {following.meter_id}"
            )

    current = next(
        (
            interval
            for interval in history
            if interval.period_start <= effective_at
            and (interval.period_end is None or effective_at < interval.period_end)
        ),
        None,
    )
    return current, history[-1] if history else None


def plan_meter_interval_change(
    current: BillingInterval | None,
    desired_state: SubscriptionMeterBillingState | None,
    *,
    effective_at: datetime,
) -> IntervalChangePlan:
    current_state = (
        SubscriptionMeterBillingState(
            current.meter_id, current.product_price_id, current.usage_policy
        )
        if current is not None
        else None
    )
    if current_state == desired_state:
        return IntervalChangePlan(effective_at=effective_at)
    return IntervalChangePlan(
        effective_at=effective_at,
        close_interval_ids=(current.id,) if current is not None else (),
        new_interval_states=(desired_state,) if desired_state is not None else (),
    )


def plan_interval_changes(
    intervals: Sequence[BillingInterval],
    desired_states: Sequence[SubscriptionMeterBillingState],
    *,
    effective_at: datetime,
) -> IntervalChangePlan:
    """Preserve committed history; never create a zero-length interval."""
    desired_by_meter: dict[UUID, SubscriptionMeterBillingState] = {}
    for state in desired_states:
        if state.meter_id in desired_by_meter:
            raise BillingIntervalConflict(
                f"Multiple billing states for meter {state.meter_id}"
            )
        desired_by_meter[state.meter_id] = state

    history_by_meter: dict[UUID, list[BillingInterval]] = defaultdict(list)
    for interval in intervals:
        history_by_meter[interval.meter_id].append(interval)

    close_interval_ids: list[UUID] = []
    new_interval_states: list[SubscriptionMeterBillingState] = []
    for meter_id in sorted(desired_by_meter.keys() | history_by_meter.keys()):
        current, latest = resolve_meter_interval_history(
            history_by_meter[meter_id], effective_at=effective_at
        )
        plan = plan_meter_interval_change(
            current, desired_by_meter.get(meter_id), effective_at=effective_at
        )
        if plan == IntervalChangePlan(effective_at=effective_at):
            continue

        if (latest is not None and latest.period_start > effective_at) or (
            current is not None and current.period_end is not None
        ):
            raise BillingIntervalConflict(
                f"Change for meter {meter_id} at {effective_at.isoformat()} "
                "conflicts with later history and requires repair"
            )

        if current is not None and current.period_start == effective_at:
            raise BillingIntervalConflict(
                f"Change for meter {meter_id} at {effective_at.isoformat()} "
                "would replace a committed interval starting at the same time"
            )
        close_interval_ids.extend(plan.close_interval_ids)
        new_interval_states.extend(plan.new_interval_states)

    return IntervalChangePlan(
        effective_at=effective_at,
        close_interval_ids=tuple(close_interval_ids),
        new_interval_states=tuple(new_interval_states),
    )


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


billing_interval = BillingIntervalService()
