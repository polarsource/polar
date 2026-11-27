import contextlib
import dataclasses
from collections import defaultdict
from collections.abc import AsyncIterator, Iterable, Mapping, Sequence
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from itertools import pairwise
from uuid import UUID

import structlog

from polar.event.repository import EventRepository
from polar.exceptions import PolarError
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.meter.aggregation import AggregationFunction, UniqueAggregation
from polar.models import BillingInterval, Customer, Subscription
from polar.models.billing_interval import UsagePolicy
from polar.models.reducer import ReducerKind
from polar.models.subscription import SubscriptionStatus
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncReadSession, AsyncSession
from polar.product.guard import is_metered_price
from polar.redis import Redis
from polar.reducer.bucket_repository import (
    CustomerIdentity,
    ReducerBucketRepository,
    get_customer_identities,
)
from polar.reducer.repository import ReducerRepository
from polar.reducer.service import finalize_quantity, merge_summaries
from polar.reducer.service import reducer as reducer_service
from polar.reducer.types import (
    BucketTotals,
    MeterUsage,
    UsageWindow,
    WindowUsage,
)
from polar.subscription.repository import SubscriptionRepository

from .repository import BillingIntervalRepository
from .types import (
    BillingIntervalGenerationStatus,
    IntervalChangePlan,
    IntervalGeneration,
    IntervalUsage,
    IntervalUsageGroup,
    MeterCharge,
    SubscriptionMeterBillingState,
)

log: Logger = structlog.get_logger()

BILL_USAGE_LOCK_TIMEOUT = "2s"

SUMMABLE_FUNCTIONS = (AggregationFunction.cnt, AggregationFunction.sum)

USAGE_POLICIES = {
    SubscriptionStatus.active: UsagePolicy.charge,
    SubscriptionStatus.past_due: UsagePolicy.charge,
    SubscriptionStatus.trialing: UsagePolicy.trial,
    SubscriptionStatus.paused: UsagePolicy.paused,
    SubscriptionStatus.trial_ended: UsagePolicy.paused,
}


class BillingIntervalConflict(PolarError):
    def __init__(self, message: str) -> None:
        super().__init__(message, 409)


class ReducerUsageUnavailable(PolarError):
    def __init__(self, subscription: Subscription, meter_ids: Iterable[UUID]) -> None:
        self.subscription = subscription
        self.meter_ids = sorted(meter_ids)
        super().__init__(
            f"Reducer usage of subscription {subscription.id} is unavailable "
            f"for meters {', '.join(str(meter_id) for meter_id in self.meter_ids)}."
        )


class BillingIntervalService:
    async def record_subscription(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        effective_at: datetime,
    ) -> None:
        """Reconcile terms in the caller's transaction. Failures are logged, not
        raised, unless the organization bills from the reducers: its orders charge
        what the intervals say."""
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
            if await OrganizationRepository.from_session(session).get_ids_with_feature(
                {subscription.organization_id}, "reducer_billing_enabled"
            ):
                raise
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
        session: AsyncReadSession,
        customer: Customer,
        meter_id: UUID,
        *,
        cutoff: datetime,
        charged_only: bool = True,
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
        return resolve_ownership(
            intervals, subscription_starts, cutoff=cutoff, charged_only=charged_only
        )

    async def list_usage(
        self, session: AsyncReadSession, subscription: Subscription
    ) -> list[IntervalUsage]:
        intervals_by_meter: dict[UUID, list[BillingInterval]] = defaultdict(list)
        for interval in await BillingIntervalRepository.from_session(
            session
        ).get_by_subscription_with_prices(subscription.id):
            if not isinstance(interval.meter.aggregation, UniqueAggregation):
                intervals_by_meter[interval.meter_id].append(interval)
        return [
            usage
            for meter_id, intervals in intervals_by_meter.items()
            for usage in await self._get_meter_usage(
                session, subscription, meter_id, intervals
            )
        ]

    async def _get_meter_usage(
        self,
        session: AsyncReadSession,
        subscription: Subscription,
        meter_id: UUID,
        intervals: Sequence[BillingInterval],
    ) -> list[IntervalUsage]:
        customer = subscription.customer
        interval_ids = {interval.id for interval in intervals}
        windows = [
            window
            for window in await self.get_usage_windows(
                session, customer, meter_id, cutoff=utc_now(), charged_only=False
            )
            if window.interval_id in interval_ids
        ]

        identities = get_customer_identities(customer)
        reducer = await ReducerRepository.from_session(session).get_by_meter_and_kind(
            meter_id, ReducerKind.usage
        )
        if reducer is None or not windows:
            return [IntervalUsage(interval, ()) for interval in intervals]
        function = reducer.aggregation.func
        usage_totals = await ReducerBucketRepository.from_session(
            session
        ).get_window_totals(
            reducer, identities, [(window.start, window.end) for window in windows]
        )

        type GroupKey = tuple[UUID | None, bool]
        usage_by_interval: dict[
            UUID, dict[GroupKey, dict[tuple[int, UUID | None], list[BucketTotals]]]
        ] = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
        for (
            index,
            root_order_id,
            root_open,
            generation,
            order_id,
        ), totals in usage_totals.items():
            interval_id = windows[index].interval_id
            usage_by_interval[interval_id][(root_order_id, root_open)][
                (generation, order_id)
            ].append(totals)

        groups_by_interval: dict[
            UUID, list[tuple[GroupKey, BucketTotals, list[IntervalGeneration]]]
        ] = defaultdict(list)
        for interval in intervals:
            for key, rows in usage_by_interval[interval.id].items():
                generations = [
                    get_interval_generation(
                        interval,
                        generation,
                        order_id,
                        merge_totals(rows[(generation, order_id)]),
                        function,
                    )
                    for generation, order_id in sorted(
                        rows, key=lambda key: (key[0], key[1] is None, str(key[1]))
                    )
                ]
                group_totals = merge_totals(
                    [total for totals in rows.values() for total in totals]
                )
                groups_by_interval[interval.id].append((key, group_totals, generations))

        credits = await self._get_group_credits(
            session,
            customer,
            meter_id,
            identities,
            [
                (key, totals.start)
                for interval in intervals
                if interval.usage_policy == UsagePolicy.charge
                for key, totals, _ in groups_by_interval[interval.id]
            ],
        )

        usages: list[IntervalUsage] = []
        for interval in intervals:
            groups: list[IntervalUsageGroup] = []
            for key, group_totals, generations in groups_by_interval[interval.id]:
                units = finalize_quantity(group_totals.summary, function)
                groups.append(
                    IntervalUsageGroup(
                        group_totals.start,
                        group_totals.end,
                        units,
                        credits.get((key, group_totals.start), Decimal(0)),
                        get_amount(interval, units),
                        tuple(generations),
                    )
                )
            groups.sort(key=lambda group: group.period_start, reverse=True)
            usages.append(IntervalUsage(interval, tuple(groups)))
        return usages

    async def _get_group_credits(
        self,
        session: AsyncReadSession,
        customer: Customer,
        meter_id: UUID,
        identities: Sequence[CustomerIdentity],
        groups: Sequence[tuple[tuple[UUID | None, bool], datetime]],
    ) -> dict[tuple[tuple[UUID | None, bool], datetime], Decimal]:
        reducer = await ReducerRepository.from_session(session).get_by_meter_and_kind(
            meter_id, ReducerKind.credit
        )
        if reducer is None or not groups:
            return {}
        by_order = await ReducerBucketRepository.from_session(
            session
        ).get_totals_by_order(
            reducer,
            identities,
            [order_id for (order_id, _), _ in groups if order_id is not None],
        )
        credits: dict[tuple[tuple[UUID | None, bool], datetime], Decimal] = {}
        for group in sorted(groups, key=lambda group: group[1]):
            (order_id, _), _ = group
            if order_id in by_order:
                credits[group] = max(
                    Decimal(0),
                    finalize_quantity(by_order.pop(order_id), reducer.aggregation.func),
                )
        unbilled = [group for group in groups if group[0][0] is None]
        if unbilled:
            key = (reducer.id, customer.id)
            pending = await reducer_service.get_credits(
                session, reducer.organization_id, [key]
            )
            credits[max(unbilled, key=lambda group: group[1])] = max(
                Decimal(pending[key][1]), Decimal(0)
            )
        return credits

    async def get_meter_ids(
        self, session: AsyncReadSession, subscription: Subscription
    ) -> set[UUID]:
        """The meters the subscription has intervals on, including those it no
        longer has a price for."""
        intervals = await BillingIntervalRepository.from_session(
            session
        ).get_by_subscription(subscription.id)
        return {interval.meter_id for interval in intervals}

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
        try:
            async with self._settlement_windows(
                session, subscription, meter_ids, cutoff=cutoff
            ) as windows:
                quantities = await reducer_service.bill(
                    session,
                    subscription.customer,
                    meter_ids,
                    order_id=order_id,
                    windows=windows,
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

    async def seal_usage(
        self,
        session: AsyncSession,
        subscription: Subscription,
        meter_ids: Iterable[UUID],
        *,
        period_start: datetime | None,
        cutoff: datetime,
    ) -> tuple[dict[UUID, MeterCharge], list[UUID]]:
        """Seals the usage an order billing the period from `period_start` to
        `cutoff` charges, at the price of the interval it falls in, and returns it
        with the ids of its buckets, for `reducer.mark_as_billed` once the order
        exists. Failures raise, and so does a meter without usage."""
        meter_ids = sorted(meter_ids)
        async with self._settlement_windows(
            session, subscription, meter_ids, cutoff=cutoff
        ) as windows:
            period_starts = await self._get_usage_period_starts(
                session,
                subscription.customer,
                meter_ids,
                windows,
                period_start=period_start,
                cutoff=cutoff,
            )
            usage, bucket_ids = await reducer_service.seal_usage(
                session,
                subscription.customer,
                meter_ids,
                windows=split_windows(windows, at=period_starts),
                cutoff=cutoff,
            )
        if usage.keys() != set(meter_ids):
            raise ReducerUsageUnavailable(subscription, set(meter_ids) - usage.keys())
        charges = await self._get_meter_charges(
            session, subscription, usage, period_starts=period_starts, cutoff=cutoff
        )
        return charges, bucket_ids

    async def get_pending_usage(
        self,
        session: AsyncSession,
        redis: Redis,
        subscription: Subscription,
        *,
        period_start: datetime | None,
        cutoff: datetime,
    ) -> dict[UUID, MeterCharge]:
        """What `seal_usage` would charge for an order billing the period from
        `period_start` to `cutoff`, on every meter the subscription has intervals
        on, without sealing or marking it."""
        meter_ids = sorted(await self.get_meter_ids(session, subscription))
        windows = await self._get_settlement_windows(
            session, subscription, meter_ids, cutoff=cutoff
        )
        period_starts = await self._get_usage_period_starts(
            session,
            subscription.customer,
            meter_ids,
            windows,
            period_start=period_start,
            cutoff=cutoff,
        )
        usage = await reducer_service.get_pending_usage(
            session,
            redis,
            subscription.customer,
            meter_ids,
            windows=split_windows(windows, at=period_starts),
        )
        return await self._get_meter_charges(
            session, subscription, usage, period_starts=period_starts, cutoff=cutoff
        )

    async def _get_meter_charges(
        self,
        session: AsyncReadSession,
        subscription: Subscription,
        usage: Mapping[UUID, MeterUsage],
        *,
        period_starts: Mapping[UUID, datetime | None],
        cutoff: datetime,
    ) -> dict[UUID, MeterCharge]:
        intervals = await BillingIntervalRepository.from_session(
            session
        ).get_by_subscription(subscription.id)
        price_ids = {interval.id: interval.product_price_id for interval in intervals}
        return {
            meter_id: get_meter_charge(
                meter_usage,
                price_ids,
                period_start=period_starts[meter_id],
                cutoff=cutoff,
            )
            for meter_id, meter_usage in usage.items()
        }

    async def _get_settlement_windows(
        self,
        session: AsyncSession,
        subscription: Subscription,
        meter_ids: Sequence[UUID],
        *,
        cutoff: datetime,
    ) -> tuple[UsageWindow, ...]:
        windows: list[UsageWindow] = []
        for meter_id in meter_ids:
            windows.extend(
                await self.get_usage_windows(
                    session, subscription.customer, meter_id, cutoff=cutoff
                )
            )
        return select_settlement_windows(
            windows, billing_subscription_id=subscription.id
        )

    async def _get_usage_period_starts(
        self,
        session: AsyncSession,
        customer: Customer,
        meter_ids: Sequence[UUID],
        windows: Sequence[UsageWindow],
        *,
        period_start: datetime | None,
        cutoff: datetime,
    ) -> dict[UUID, datetime | None]:
        """The start of the usage an order billing from `period_start` to `cutoff`
        settles on each meter."""
        repository = EventRepository.from_session(session)
        period_starts: dict[UUID, datetime | None] = {}
        for meter_id in meter_ids:
            reset = await repository.get_latest_meter_reset(
                customer, meter_id, cutoff=cutoff
            )
            period_starts[meter_id] = get_usage_period_start(
                period_start,
                None if reset is None else reset.timestamp,
                [window for window in windows if window.meter_id == meter_id],
            )
        return period_starts

    @contextlib.asynccontextmanager
    async def _settlement_windows(
        self,
        session: AsyncSession,
        subscription: Subscription,
        meter_ids: Sequence[UUID],
        *,
        cutoff: datetime,
    ) -> AsyncIterator[tuple[UsageWindow, ...]]:
        """The windows the subscription settles on the meters, in a savepoint
        that doesn't wait on a lock for longer than BILL_USAGE_LOCK_TIMEOUT."""
        repository = BillingIntervalRepository.from_session(session)
        async with (
            repository.local_lock_timeout(BILL_USAGE_LOCK_TIMEOUT),
            session.begin_nested(),
        ):
            yield await self._get_settlement_windows(
                session, subscription, meter_ids, cutoff=cutoff
            )


def get_usage_period_start(
    period_start: datetime | None,
    last_reset_at: datetime | None,
    windows: Sequence[UsageWindow],
) -> datetime | None:
    """The start of the usage an order settles on a meter: `period_start`, or
    earlier if nothing was settled since. A subscription that isn't active keeps
    its meter clock running without settling or resetting the meter, so its
    usage since the last reset, or since it started, is still to bill."""
    if period_start is None:
        return None
    unsettled_since = (
        last_reset_at
        if last_reset_at is not None
        else min((window.start for window in windows), default=period_start)
    )
    return min(period_start, unsettled_since)


def split_windows(
    windows: Sequence[UsageWindow], *, at: Mapping[UUID, datetime | None]
) -> tuple[UsageWindow, ...]:
    """Splits each window the datetime of its meter falls inside, so the usage
    before it and from it is observed apart."""
    split: list[UsageWindow] = []
    for window in windows:
        split_at = at.get(window.meter_id)
        if split_at is not None and window.start < split_at < window.end:
            split.append(dataclasses.replace(window, end=split_at))
            split.append(dataclasses.replace(window, start=split_at))
        else:
            split.append(window)
    return tuple(split)


def get_meter_charge(
    usage: MeterUsage,
    price_ids: Mapping[UUID, UUID],
    *,
    period_start: datetime | None,
    cutoff: datetime,
) -> MeterCharge:
    """The meter's usage by the price of the interval each window is in, for an
    order billing the period from `period_start` to `cutoff`.
    `price_ids` are the price ids by interval id.

    A max, min or average only counts the usage of the billed period. Usage
    arriving late for an earlier period is left out: that period's value is
    already billed, and a late reading can't be added to it like a sum can."""
    windows_by_price: dict[UUID, list[WindowUsage]] = defaultdict(list)
    for window_usage in sorted(usage.windows, key=lambda usage: usage.window.start):
        if (
            usage.function not in SUMMABLE_FUNCTIONS
            and period_start is not None
            and window_usage.window.end <= period_start
        ):
            continue
        price_id = price_ids[window_usage.window.interval_id]
        windows_by_price[price_id].append(window_usage)
    return MeterCharge(
        units=finalize_quantity(
            merge_summaries(
                [
                    window_usage.summary
                    for windows in windows_by_price.values()
                    for window_usage in windows
                ]
            ),
            usage.function,
        ),
        units_by_price={
            price_id: finalize_quantity(
                merge_summaries([window_usage.summary for window_usage in windows]),
                usage.function,
            )
            for price_id, windows in windows_by_price.items()
        },
        period_shares={
            price_id: get_period_share(
                usage.function,
                [window_usage.window for window_usage in windows],
                period_start=period_start,
                cutoff=cutoff,
            )
            for price_id, windows in windows_by_price.items()
        },
        credited_units=usage.credits,
    )


def merge_totals(totals: Sequence[BucketTotals]) -> BucketTotals:
    return BucketTotals(
        merge_summaries([total.summary for total in totals]),
        min(total.start for total in totals),
        max(total.end for total in totals),
        any(total.has_open for total in totals),
        any(total.has_unbilled for total in totals),
    )


def get_amount(interval: BillingInterval, units: Decimal) -> int:
    price = interval.product_price
    if interval.usage_policy != UsagePolicy.charge or not is_metered_price(price):
        return 0
    amount, _ = price.get_amount_and_label(float(units))
    return amount


def get_interval_generation(
    interval: BillingInterval,
    generation: int,
    order_id: UUID | None,
    totals: BucketTotals,
    function: AggregationFunction,
) -> IntervalGeneration:
    units = finalize_quantity(totals.summary, function)
    if interval.usage_policy != UsagePolicy.charge:
        status = BillingIntervalGenerationStatus.not_charged
    elif totals.has_open:
        status = BillingIntervalGenerationStatus.open
    elif totals.has_unbilled:
        status = BillingIntervalGenerationStatus.unbilled
    else:
        status = BillingIntervalGenerationStatus.billed
    return IntervalGeneration(
        generation, order_id, units, get_amount(interval, units), status
    )


def get_period_share(
    function: AggregationFunction,
    windows: Sequence[UsageWindow],
    *,
    period_start: datetime | None,
    cutoff: datetime,
) -> Decimal:
    """The share of the billed period, from `period_start` to `cutoff`, the windows
    cover. A max, min or average doesn't shrink with its window, so it is charged
    for that share only. Sums and counts are charged in full."""
    if function in SUMMABLE_FUNCTIONS or period_start is None or period_start >= cutoff:
        return Decimal(1)
    covered = sum(
        (
            min(window.end, cutoff) - max(window.start, period_start)
            for window in windows
            if window.end > period_start
        ),
        timedelta(0),
    )
    if not covered:
        return Decimal(1)
    microsecond = timedelta(microseconds=1)
    return min(
        Decimal(1),
        Decimal(covered // microsecond)
        / Decimal((cutoff - period_start) // microsecond),
    )


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
    charged_only: bool = True,
) -> tuple[UsageWindow, ...]:
    """Chargeable windows before `cutoff`, each owned by the covering interval of
    the earliest started subscription. Usage won by a trial or paused interval is
    excluded, not passed to the next subscription, unless `charged_only` is
    False."""

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
            if charged_only and owner.usage_policy != UsagePolicy.charge:
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
