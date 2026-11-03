from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest

from polar.billing_interval.service import (
    BillingIntervalConflict,
    derive_meter_billing_states,
    get_interval_boundaries,
    plan_interval_changes,
    plan_meter_interval_change,
    resolve_meter_interval_history,
)
from polar.billing_interval.types import (
    IntervalChangePlan,
    SubscriptionMeterBillingState,
)
from polar.models import (
    BillingInterval,
    Meter,
    ProductPriceFixed,
    ProductPriceMeteredTiers,
    ProductPriceMeteredUnit,
    Subscription,
    SubscriptionProductPrice,
)
from polar.models.billing_interval import UsagePolicy
from polar.models.subscription import SubscriptionStatus

START = datetime(2026, 1, 1, tzinfo=UTC)
CHANGE = datetime(2026, 2, 1, tzinfo=UTC)
END = datetime(2026, 3, 1, tzinfo=UTC)


@pytest.fixture
def meter() -> Meter:
    return Meter(id=UUID(int=1))


@pytest.fixture
def price(meter: Meter) -> ProductPriceMeteredUnit:
    return ProductPriceMeteredUnit(
        id=uuid4(), meter=meter, meter_id=meter.id, price_currency="usd"
    )


@pytest.fixture
def subscription(price: ProductPriceMeteredUnit) -> Subscription:
    return Subscription(
        status=SubscriptionStatus.active,
        subscription_product_prices=[SubscriptionProductPrice.from_price(price)],
    )


@pytest.fixture
def interval(meter: Meter, price: ProductPriceMeteredUnit) -> BillingInterval:
    return BillingInterval(
        id=uuid4(),
        meter=meter,
        meter_id=meter.id,
        product_price=price,
        product_price_id=price.id,
        period_start=START,
        period_end=None,
        usage_policy=UsagePolicy.charge,
    )


class TestDeriveMeterBillingStates:
    @pytest.mark.parametrize(
        ("status", "policy"),
        [
            (SubscriptionStatus.active, UsagePolicy.charge),
            (SubscriptionStatus.past_due, UsagePolicy.charge),
            (SubscriptionStatus.trialing, UsagePolicy.trial),
            (SubscriptionStatus.paused, UsagePolicy.paused),
            (SubscriptionStatus.incomplete, None),
            (SubscriptionStatus.incomplete_expired, None),
            (SubscriptionStatus.canceled, None),
            (SubscriptionStatus.unpaid, None),
        ],
    )
    def test_subscription_policy(
        self,
        subscription: Subscription,
        meter: Meter,
        price: ProductPriceMeteredUnit,
        status: SubscriptionStatus,
        policy: UsagePolicy | None,
    ) -> None:
        subscription.status = status

        assert derive_meter_billing_states(subscription) == (
            (SubscriptionMeterBillingState(meter.id, price.id, policy),)
            if policy is not None
            else ()
        )

    def test_deleted_subscription_has_no_states(
        self, subscription: Subscription, meter: Meter
    ) -> None:
        subscription.deleted_at = CHANGE

        assert derive_meter_billing_states(subscription) == ()

    @pytest.mark.parametrize(
        "status", [SubscriptionStatus.active, SubscriptionStatus.paused]
    )
    @pytest.mark.parametrize("unavailable_field", ["archived_at", "deleted_at"])
    def test_unavailable_meter_has_no_states(
        self,
        subscription: Subscription,
        meter: Meter,
        status: SubscriptionStatus,
        unavailable_field: str,
    ) -> None:
        subscription.status = status
        setattr(meter, unavailable_field, CHANGE)

        assert derive_meter_billing_states(subscription) == ()

    def test_uses_retained_metered_prices_in_stable_order(
        self,
        subscription: Subscription,
        meter: Meter,
        price: ProductPriceMeteredUnit,
    ) -> None:
        price.is_archived = True
        second_meter = Meter(id=UUID(int=2))
        tiered_price = ProductPriceMeteredTiers(
            id=uuid4(), meter=second_meter, meter_id=second_meter.id
        )
        subscription.subscription_product_prices = [
            SubscriptionProductPrice.from_price(tiered_price),
            SubscriptionProductPrice.from_price(ProductPriceFixed(price_amount=1000)),
            SubscriptionProductPrice.from_price(price),
        ]

        desired_states = derive_meter_billing_states(subscription)

        assert desired_states == (
            SubscriptionMeterBillingState(meter.id, price.id, UsagePolicy.charge),
            SubscriptionMeterBillingState(
                second_meter.id, tiered_price.id, UsagePolicy.charge
            ),
        )

    def test_renewal_discount_and_scheduled_changes_do_not_change_states(
        self, subscription: Subscription, meter: Meter
    ) -> None:
        original = derive_meter_billing_states(subscription)
        subscription.current_period_start = CHANGE
        subscription.current_period_end = END
        subscription.discount_id = uuid4()
        subscription.seats = 10
        subscription.pause_at_period_end = True
        subscription.cancel_at_period_end = True

        assert derive_meter_billing_states(subscription) == original

    def test_multiple_prices_for_one_meter_are_ambiguous(
        self, subscription: Subscription, meter: Meter
    ) -> None:
        subscription.subscription_product_prices.append(
            SubscriptionProductPrice.from_price(
                ProductPriceMeteredUnit(id=uuid4(), meter=meter, meter_id=meter.id)
            )
        )

        with pytest.raises(
            BillingIntervalConflict, match="Multiple subscription prices"
        ):
            derive_meter_billing_states(subscription)


class TestPlanMeterIntervalChange:
    def test_start_opens_states(
        self, meter: Meter, price: ProductPriceMeteredUnit
    ) -> None:
        desired_states = (
            SubscriptionMeterBillingState(meter.id, price.id, UsagePolicy.charge),
        )

        assert plan_meter_interval_change(
            None, desired_states[0], effective_at=START
        ) == IntervalChangePlan(
            effective_at=START,
            close_interval_ids=(),
            new_interval_states=desired_states,
        )

    @pytest.mark.parametrize("effective_at", [START, CHANGE])
    def test_unchanged_states_preserve_interval(
        self, interval: BillingInterval, effective_at: datetime
    ) -> None:
        desired_states = (
            SubscriptionMeterBillingState(
                interval.meter_id, interval.product_price_id, interval.usage_policy
            ),
        )

        assert plan_meter_interval_change(
            interval, desired_states[0], effective_at=effective_at
        ) == IntervalChangePlan(
            effective_at=effective_at,
            close_interval_ids=(),
            new_interval_states=(),
        )
        assert interval.period_end is None

    @pytest.mark.parametrize(
        ("before", "after"),
        [
            (UsagePolicy.charge, UsagePolicy.trial),
            (UsagePolicy.trial, UsagePolicy.charge),
            (UsagePolicy.charge, UsagePolicy.paused),
            (UsagePolicy.paused, UsagePolicy.charge),
        ],
    )
    def test_policy_transition_preserves_prior_history(
        self, interval: BillingInterval, before: UsagePolicy, after: UsagePolicy
    ) -> None:
        interval.usage_policy = before
        desired_states = (
            SubscriptionMeterBillingState(
                interval.meter_id, interval.product_price_id, after
            ),
        )

        assert plan_meter_interval_change(
            interval, desired_states[0], effective_at=CHANGE
        ) == IntervalChangePlan(
            effective_at=CHANGE,
            close_interval_ids=(interval.id,),
            new_interval_states=desired_states,
        )
        assert interval.period_end is None
        assert interval.usage_policy == before

    def test_price_change_replaces_interval(self, interval: BillingInterval) -> None:
        desired_states = (
            SubscriptionMeterBillingState(
                interval.meter_id, uuid4(), interval.usage_policy
            ),
        )

        assert plan_meter_interval_change(
            interval, desired_states[0], effective_at=CHANGE
        ) == IntervalChangePlan(
            effective_at=CHANGE,
            close_interval_ids=(interval.id,),
            new_interval_states=desired_states,
        )

    def test_removal_closes_interval(self, interval: BillingInterval) -> None:
        assert plan_meter_interval_change(
            interval, None, effective_at=CHANGE
        ) == IntervalChangePlan(effective_at=CHANGE, close_interval_ids=(interval.id,))

    def test_absent_state_stays_absent(self) -> None:
        assert plan_meter_interval_change(
            None, None, effective_at=CHANGE
        ) == IntervalChangePlan(effective_at=CHANGE)


class TestResolveMeterIntervalHistory:
    def test_empty_history(self) -> None:
        assert resolve_meter_interval_history([], effective_at=START) == (None, None)

    @pytest.mark.parametrize(
        ("effective_at", "expected_index"),
        [
            (START - timedelta(days=1), None),
            (START, 0),
            (START + timedelta(days=1), 0),
            (CHANGE, None),
            (CHANGE + timedelta(days=1), None),
            (END, 1),
        ],
    )
    def test_resolves_boundaries_and_gaps(
        self,
        interval: BillingInterval,
        effective_at: datetime,
        expected_index: int | None,
    ) -> None:
        interval.period_end = CHANGE
        resumed = BillingInterval(
            id=uuid4(),
            meter_id=interval.meter_id,
            product_price_id=interval.product_price_id,
            period_start=END,
            period_end=None,
            usage_policy=UsagePolicy.charge,
        )
        history = [interval, resumed]

        current, latest = resolve_meter_interval_history(
            list(reversed(history)), effective_at=effective_at
        )

        assert current is (
            history[expected_index] if expected_index is not None else None
        )
        assert latest is resumed


class TestPlanIntervalChanges:
    def test_add_and_remove_leave_another_meter_unchanged(
        self, interval: BillingInterval
    ) -> None:
        retained = BillingInterval(
            id=uuid4(),
            meter_id=UUID(int=2),
            product_price_id=uuid4(),
            period_start=START,
            period_end=None,
            usage_policy=UsagePolicy.charge,
        )
        added = SubscriptionMeterBillingState(UUID(int=3), uuid4(), UsagePolicy.charge)
        desired_states = (
            added,
            SubscriptionMeterBillingState(
                retained.meter_id, retained.product_price_id, retained.usage_policy
            ),
        )

        assert plan_interval_changes(
            [retained, interval], desired_states, effective_at=CHANGE
        ) == IntervalChangePlan(
            effective_at=CHANGE,
            close_interval_ids=(interval.id,),
            new_interval_states=(added,),
        )
        assert retained.period_end is None

    def test_removal_and_restoration_preserve_gap(
        self, interval: BillingInterval
    ) -> None:
        assert plan_interval_changes(
            [interval], (), effective_at=CHANGE
        ) == IntervalChangePlan(
            effective_at=CHANGE,
            close_interval_ids=(interval.id,),
            new_interval_states=(),
        )

        interval.period_end = CHANGE
        assert plan_interval_changes(
            [interval], (), effective_at=CHANGE
        ) == IntervalChangePlan(
            effective_at=CHANGE,
            close_interval_ids=(),
            new_interval_states=(),
        )
        desired_states = (
            SubscriptionMeterBillingState(
                interval.meter_id, interval.product_price_id, interval.usage_policy
            ),
        )
        assert plan_interval_changes(
            [interval], desired_states, effective_at=END
        ) == IntervalChangePlan(
            effective_at=END,
            close_interval_ids=(),
            new_interval_states=desired_states,
        )
        assert interval.period_end == CHANGE

    @pytest.mark.parametrize("replace", [True, False])
    def test_same_time_committed_change_requires_repair(
        self, interval: BillingInterval, replace: bool
    ) -> None:
        desired_states = (
            (
                SubscriptionMeterBillingState(
                    interval.meter_id, uuid4(), UsagePolicy.paused
                ),
            )
            if replace
            else ()
        )

        with pytest.raises(BillingIntervalConflict, match="committed interval") as exc:
            plan_interval_changes([interval], desired_states, effective_at=START)

        assert exc.value.status_code == 409
        assert interval.period_end is None

    @pytest.mark.parametrize("effective_at", [START - timedelta(days=1), CHANGE])
    def test_conflicting_backdated_states_require_repair(
        self, interval: BillingInterval, effective_at: datetime
    ) -> None:
        interval.period_end = END
        desired_states = (
            SubscriptionMeterBillingState(
                interval.meter_id, uuid4(), UsagePolicy.charge
            ),
        )

        with pytest.raises(BillingIntervalConflict, match="requires repair"):
            plan_interval_changes([interval], desired_states, effective_at=effective_at)

        assert interval.period_end == END

    def test_replaying_historical_states_does_not_reopen_them(
        self, interval: BillingInterval
    ) -> None:
        interval.period_end = CHANGE
        paused = BillingInterval(
            id=uuid4(),
            meter_id=interval.meter_id,
            product_price_id=interval.product_price_id,
            period_start=CHANGE,
            period_end=None,
            usage_policy=UsagePolicy.paused,
        )
        desired_states = (
            SubscriptionMeterBillingState(
                interval.meter_id, interval.product_price_id, UsagePolicy.charge
            ),
        )

        assert plan_interval_changes(
            [paused, interval], desired_states, effective_at=START
        ) == IntervalChangePlan(
            effective_at=START,
            close_interval_ids=(),
            new_interval_states=(),
        )
        assert interval.period_end == CHANGE
        assert paused.period_end is None

    @pytest.mark.parametrize("period_end", [None, END])
    def test_overlapping_history_requires_repair(
        self, interval: BillingInterval, period_end: datetime | None
    ) -> None:
        interval.period_end = period_end
        overlapping = BillingInterval(
            id=uuid4(),
            meter_id=interval.meter_id,
            product_price_id=interval.product_price_id,
            period_start=CHANGE,
            period_end=None,
            usage_policy=UsagePolicy.charge,
        )

        with pytest.raises(BillingIntervalConflict, match="Overlapping history"):
            plan_interval_changes([overlapping, interval], (), effective_at=END)

    def test_multiple_states_for_one_meter_are_ambiguous(
        self, interval: BillingInterval
    ) -> None:
        desired_states = (
            SubscriptionMeterBillingState(
                interval.meter_id, interval.product_price_id, UsagePolicy.charge
            ),
            SubscriptionMeterBillingState(
                interval.meter_id, uuid4(), UsagePolicy.charge
            ),
        )

        with pytest.raises(BillingIntervalConflict, match="Multiple billing states"):
            plan_interval_changes([interval], desired_states, effective_at=CHANGE)


class TestGetIntervalBoundaries:
    def test_returns_distinct_boundaries_up_to_until(self) -> None:
        intervals = [
            BillingInterval(period_start=START, period_end=CHANGE),
            BillingInterval(period_start=CHANGE, period_end=END),
            BillingInterval(period_start=END, period_end=None),
        ]

        assert get_interval_boundaries(intervals, until=CHANGE) == (START, CHANGE)
