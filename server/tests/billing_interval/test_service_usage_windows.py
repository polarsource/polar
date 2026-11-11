import dataclasses
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import update

from polar.billing_interval.repository import BillingIntervalRepository
from polar.billing_interval.service import (
    BILL_USAGE_LOCK_TIMEOUT,
    ReducerUsageUnavailable,
    get_meter_charge,
    get_usage_period_start,
    split_windows,
)
from polar.billing_interval.service import billing_interval as billing_interval_service
from polar.billing_interval.types import MeterCharge
from polar.meter.aggregation import AggregationFunction
from polar.models import Customer, Meter, Product
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from polar.reducer.service import reducer as reducer_service
from polar.reducer.types import MeterUsage, UsageSummary, UsageWindow, WindowUsage
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_subscription

EARLIER = datetime(2026, 1, 1, tzinfo=UTC)
LATER = datetime(2026, 1, 5, tzinfo=UTC)
CUTOFF = datetime(2026, 1, 10, tzinfo=UTC)
PERIOD_START = datetime(2026, 1, 2, tzinfo=UTC)
SWITCH = datetime(2026, 1, 4, tzinfo=UTC)


@pytest.mark.anyio
class TestGetUsageWindows:
    async def test_soft_deleted_earlier_subscription_owns_the_overlap(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_metered: Product,
        customer: Customer,
        meter: Meter,
    ) -> None:
        subscriptions = []
        for started_at in (EARLIER, LATER):
            subscription = await create_subscription(
                save_fixture,
                product=product_recurring_metered,
                customer=customer,
                status=SubscriptionStatus.active,
                started_at=started_at,
                current_period_start=started_at,
            )
            await billing_interval_service.record_subscription(
                session, subscription, effective_at=started_at
            )
            subscriptions.append(subscription)
        earlier = subscriptions[0]
        earlier.deleted_at = LATER
        await save_fixture(earlier)
        [interval] = await BillingIntervalRepository.from_session(
            session
        ).get_by_subscription(earlier.id)

        windows = await billing_interval_service.get_usage_windows(
            session, customer, meter.id, cutoff=CUTOFF
        )

        assert windows == (
            UsageWindow(interval.id, earlier.id, meter.id, EARLIER, CUTOFF),
        )


@pytest.mark.anyio
class TestBillUsage:
    async def test_bills_only_the_subscriptions_own_windows(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_metered: Product,
        customer: Customer,
        meter: Meter,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product_recurring_metered,
            customer=customer,
            status=SubscriptionStatus.active,
        )
        own, other = (
            UsageWindow(uuid4(), subscription_id, meter.id, EARLIER, CUTOFF)
            for subscription_id in (subscription.id, uuid4())
        )
        mocker.patch.object(
            billing_interval_service, "get_usage_windows", return_value=(own, other)
        )
        bill = mocker.patch.object(
            reducer_service, "bill", return_value={meter.id: (Decimal(3), Decimal(0))}
        )
        order_id = uuid4()

        quantities = await billing_interval_service.bill_usage(
            session,
            subscription,
            [meter.id],
            order_id=order_id,
            cutoff=CUTOFF,
        )

        assert quantities == {meter.id: (Decimal(3), Decimal(0))}
        bill.assert_called_once_with(
            session,
            customer,
            [meter.id],
            order_id=order_id,
            windows=(own,),
            cutoff=CUTOFF,
        )

    async def test_shortens_the_lock_timeout_only_while_billing(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_metered: Product,
        customer: Customer,
        meter: Meter,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product_recurring_metered,
            customer=customer,
            status=SubscriptionStatus.active,
        )
        repository = BillingIntervalRepository.from_session(session)
        lock_timeout = await repository.get_lock_timeout()
        while_billing: list[str] = []

        async def record_lock_timeout(
            *args: object, **kwargs: object
        ) -> dict[object, object]:
            while_billing.append(await repository.get_lock_timeout())
            return {}

        mocker.patch.object(reducer_service, "bill", side_effect=record_lock_timeout)

        await billing_interval_service.bill_usage(
            session,
            subscription,
            [meter.id],
            order_id=uuid4(),
            cutoff=CUTOFF,
        )

        assert while_billing == [BILL_USAGE_LOCK_TIMEOUT]
        assert await repository.get_lock_timeout() == lock_timeout

    @pytest.mark.parametrize("failing", ["get_usage_windows", "bill"])
    async def test_failures_are_rolled_back_and_logged(
        self,
        failing: str,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_metered: Product,
        customer: Customer,
        meter: Meter,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product_recurring_metered,
            customer=customer,
            status=SubscriptionStatus.active,
        )
        original_name = meter.name
        repository = BillingIntervalRepository.from_session(session)
        lock_timeout = await repository.get_lock_timeout()

        async def write_then_fail(*args: object, **kwargs: object) -> None:
            await session.execute(
                update(Meter).where(Meter.id == meter.id).values(name="Written")
            )
            raise RuntimeError

        mocker.patch.object(
            billing_interval_service
            if failing == "get_usage_windows"
            else reducer_service,
            failing,
            side_effect=write_then_fail,
        )
        log = mocker.patch("polar.billing_interval.service.log")

        quantities = await billing_interval_service.bill_usage(
            session,
            subscription,
            [meter.id],
            order_id=uuid4(),
            cutoff=CUTOFF,
        )

        assert quantities == {}
        await session.refresh(meter)
        assert meter.name == original_name
        assert await repository.get_lock_timeout() == lock_timeout
        log.exception.assert_called_once()


@pytest.mark.anyio
class TestSealUsage:
    async def test_raises_for_a_meter_without_a_quantity(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_metered: Product,
        customer: Customer,
        meter: Meter,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product_recurring_metered,
            customer=customer,
            status=SubscriptionStatus.active,
        )
        mocker.patch.object(reducer_service, "seal_usage", return_value=({}, []))

        with pytest.raises(ReducerUsageUnavailable):
            await billing_interval_service.seal_usage(
                session, subscription, [meter.id], period_start=None, cutoff=CUTOFF
            )


class TestGetMeterCharge:
    def usage(
        self, interval_id: UUID, start: datetime, end: datetime, total: int
    ) -> WindowUsage:
        return WindowUsage(
            UsageWindow(interval_id, uuid4(), uuid4(), start, end),
            UsageSummary(2, Decimal(total), Decimal(1), Decimal(total)),
        )

    def test_groups_usage_by_interval_price(self) -> None:
        old_price_id, new_price_id = uuid4(), uuid4()
        old_interval_id, new_interval_id = uuid4(), uuid4()

        charge = get_meter_charge(
            MeterUsage(
                function=AggregationFunction.sum,
                windows=(
                    self.usage(new_interval_id, SWITCH, CUTOFF, 8),
                    self.usage(old_interval_id, PERIOD_START, SWITCH, 4),
                ),
                credits=Decimal(3),
            ),
            {old_interval_id: old_price_id, new_interval_id: new_price_id},
            period_start=PERIOD_START,
            cutoff=CUTOFF,
        )

        assert charge == MeterCharge(
            units=Decimal(12),
            units_by_price={old_price_id: Decimal(4), new_price_id: Decimal(8)},
            period_shares={old_price_id: Decimal(1), new_price_id: Decimal(1)},
            credited_units=Decimal(3),
        )
        assert list(charge.units_by_price) == [old_price_id, new_price_id]

    def test_average_is_per_price_with_its_share_of_the_period(self) -> None:
        old_price_id, new_price_id = uuid4(), uuid4()
        old_interval_id, new_interval_id = uuid4(), uuid4()

        charge = get_meter_charge(
            MeterUsage(
                function=AggregationFunction.avg,
                windows=(
                    self.usage(old_interval_id, PERIOD_START, SWITCH, 6),
                    self.usage(new_interval_id, SWITCH, CUTOFF, 8),
                ),
                credits=Decimal(0),
            ),
            {old_interval_id: old_price_id, new_interval_id: new_price_id},
            period_start=PERIOD_START,
            cutoff=CUTOFF,
        )

        assert charge.units_by_price == {
            old_price_id: Decimal(3),
            new_price_id: Decimal(4),
        }
        assert charge.period_shares == {
            old_price_id: Decimal("0.25"),
            new_price_id: Decimal("0.75"),
        }

    @pytest.mark.parametrize(
        ("function", "expected_units"),
        [
            (AggregationFunction.max, {}),
            (AggregationFunction.sum, {"late": Decimal(5)}),
        ],
    )
    def test_only_sums_and_counts_keep_usage_from_before_the_period(
        self, function: AggregationFunction, expected_units: dict[str, Decimal]
    ) -> None:
        price_id, interval_id = uuid4(), uuid4()

        charge = get_meter_charge(
            MeterUsage(
                function=function,
                windows=(self.usage(interval_id, EARLIER, PERIOD_START, 5),),
                credits=Decimal(0),
            ),
            {interval_id: price_id},
            period_start=PERIOD_START,
            cutoff=CUTOFF,
        )

        assert list(charge.units_by_price.values()) == list(expected_units.values())


class TestGetUsagePeriodStart:
    def window(self, start: datetime) -> UsageWindow:
        return UsageWindow(uuid4(), uuid4(), uuid4(), start, CUTOFF)

    def test_starts_at_the_period_start_when_the_meter_was_reset_then(self) -> None:
        assert (
            get_usage_period_start(PERIOD_START, PERIOD_START, [self.window(EARLIER)])
            == PERIOD_START
        )

    def test_starts_at_the_last_reset_when_the_clock_ran_past_it(self) -> None:
        assert (
            get_usage_period_start(SWITCH, PERIOD_START, [self.window(EARLIER)])
            == PERIOD_START
        )

    def test_ignores_a_reset_after_the_period_start(self) -> None:
        assert (
            get_usage_period_start(PERIOD_START, SWITCH, [self.window(EARLIER)])
            == PERIOD_START
        )

    def test_starts_at_the_first_window_when_never_reset(self) -> None:
        assert (
            get_usage_period_start(SWITCH, None, [self.window(PERIOD_START)])
            == PERIOD_START
        )

    def test_without_a_period_start(self) -> None:
        assert get_usage_period_start(None, EARLIER, []) is None


class TestSplitWindows:
    def test_splits_the_window_its_meters_period_starts_in(self) -> None:
        window = UsageWindow(uuid4(), uuid4(), uuid4(), EARLIER, CUTOFF)
        other = UsageWindow(uuid4(), uuid4(), uuid4(), EARLIER, CUTOFF)

        assert split_windows(
            [window, other], at={window.meter_id: PERIOD_START, other.meter_id: None}
        ) == (
            dataclasses.replace(window, end=PERIOD_START),
            dataclasses.replace(window, start=PERIOD_START),
            other,
        )
