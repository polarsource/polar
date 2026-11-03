import dataclasses
from collections import defaultdict
from collections.abc import Iterable, Mapping, Sequence
from datetime import UTC, datetime
from decimal import Decimal
from itertools import pairwise
from uuid import UUID

import structlog

from polar.exceptions import PolarError
from polar.logging import Logger
from polar.models import BillingInterval, Customer, Subscription
from polar.models.billing_interval import UsagePolicy
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from polar.product.guard import is_metered_price
from polar.reducer.service import reducer as reducer_service
from polar.reducer.types import UsageWindow
from polar.subscription.repository import SubscriptionRepository

from .repository import BillingIntervalRepository
from .types import IntervalChangePlan, SubscriptionMeterBillingState

log: Logger = structlog.get_logger()

BILL_USAGE_LOCK_TIMEOUT = "2s"

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

    async def get_boundaries(
        self,
        session: AsyncSession,
        customer: Customer,
        meter_id: UUID,
        *,
        until: datetime,
    ) -> tuple[datetime, ...]:
        """The customer's interval boundaries on the meter up to `until`."""
        repository = BillingIntervalRepository.from_session(session)
        intervals = await repository.get_by_customer_and_meter(
            customer, meter_id, until=until
        )
        return get_interval_boundaries(intervals, until=until)

    async def get_usage_windows(
        self,
        session: AsyncSession,
        customer: Customer,
        meter_id: UUID,
        *,
        cutoff: datetime,
    ) -> tuple[UsageWindow, ...]:
        """The customer's chargeable usage windows on the meter before `cutoff`."""
        repository = BillingIntervalRepository.from_session(session)
        intervals = await repository.get_by_customer_and_meter(
            customer, meter_id, until=cutoff
        )
        if not intervals:
            return ()
        subscription_starts = await SubscriptionRepository.from_session(
            session
        ).get_started_at_by_ids(
            list({interval.subscription_id for interval in intervals})
        )
        return resolve_ownership(intervals, subscription_starts, cutoff=cutoff)

    async def bill_usage(
        self,
        session: AsyncSession,
        subscription: Subscription,
        meter_ids: Iterable[UUID],
        *,
        order_id: UUID,
        cutoff: datetime,
    ) -> dict[UUID, tuple[Decimal, Decimal]]:
        """Marks the reducer usage the subscription owns on the meters, and its
        credits, as billed by the order, and returns their quantities per meter.
        Failures, including waiting on a bucket lock for longer than
        BILL_USAGE_LOCK_TIMEOUT, are rolled back and logged, so they never affect
        the order."""
        meter_ids = sorted(meter_ids)
        repository = BillingIntervalRepository.from_session(session)
        try:
            async with (
                repository.local_lock_timeout(BILL_USAGE_LOCK_TIMEOUT),
                session.begin_nested(),
            ):
                windows: list[UsageWindow] = []
                for meter_id in meter_ids:
                    windows.extend(
                        await self.get_usage_windows(
                            session, subscription.customer, meter_id, cutoff=cutoff
                        )
                    )
                quantities = await reducer_service.bill(
                    session,
                    subscription.customer,
                    meter_ids,
                    order_id=order_id,
                    windows=select_settlement_windows(
                        windows, billing_subscription_id=subscription.id
                    ),
                    cutoff=cutoff,
                )
        except Exception:
            log.exception(
                "Failed to bill reducer usage",
                subscription_id=subscription.id,
                order_id=order_id,
                cutoff=cutoff.isoformat(),
            )
            quantities = {}
        return quantities


def get_interval_boundaries(
    intervals: Sequence[BillingInterval],
    *,
    until: datetime,
) -> tuple[datetime, ...]:
    boundaries = {
        boundary
        for interval in intervals
        for boundary in (interval.period_start, interval.period_end)
        if boundary is not None
    }
    return tuple(sorted(boundary for boundary in boundaries if boundary <= until))


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
    """Chargeable windows before `cutoff`, each owned by the covering interval of
    the earliest started subscription. Usage won by a trial or paused interval is
    excluded, not passed to the next subscription."""

    def rank(interval: BillingInterval) -> tuple[bool, datetime, UUID]:
        started_at = subscription_starts[interval.subscription_id]
        return (
            started_at is None,
            started_at or datetime.max.replace(tzinfo=UTC),
            interval.subscription_id,
        )

    history_by_meter: dict[UUID, list[BillingInterval]] = defaultdict(list)
    for interval in intervals:
        if interval.period_start < cutoff:
            history_by_meter[interval.meter_id].append(interval)

    windows: list[UsageWindow] = []
    for meter_id in sorted(history_by_meter):
        history = history_by_meter[meter_id]
        boundaries = sorted(
            {interval.period_start for interval in history}
            | {
                interval.period_end
                for interval in history
                if interval.period_end is not None and interval.period_end < cutoff
            }
            | {cutoff}
        )
        for start, end in pairwise(boundaries):
            covering = [
                interval
                for interval in history
                if interval.period_start <= start
                and (interval.period_end is None or start < interval.period_end)
            ]
            if not covering:
                continue
            owner = min(covering, key=rank)
            if owner.usage_policy != UsagePolicy.charge:
                continue
            previous = windows[-1] if windows else None
            if (
                previous is not None
                and previous.interval_id == owner.id
                and previous.end == start
            ):
                windows[-1] = dataclasses.replace(previous, end=end)
            else:
                windows.append(
                    UsageWindow(owner.id, owner.subscription_id, meter_id, start, end)
                )
    return tuple(windows)


def select_settlement_windows(
    windows: Sequence[UsageWindow], *, billing_subscription_id: UUID
) -> tuple[UsageWindow, ...]:
    """The windows a bill charges: those its own subscription owns. Usage of an
    ended subscription arriving after its final bill is never charged."""
    return tuple(
        window
        for window in windows
        if window.source_subscription_id == billing_subscription_id
    )


billing_interval = BillingIntervalService()
