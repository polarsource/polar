from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

import pytest
import pytest_asyncio

from polar.enums import SubscriptionRecurringInterval
from polar.event.system import SystemEvent
from polar.meter.aggregation import (
    AggregationFunction,
    CountAggregation,
    PropertyAggregation,
)
from polar.meter.filter import Filter, FilterConjunction
from polar.meter_period.repository import MeterPeriodRepository
from polar.meter_period.service import MeterPeriodSettlement
from polar.meter_period.service import (
    meter_period as meter_period_service,
)
from polar.models import (
    BillingEntry,
    Customer,
    Meter,
    MeterPeriod,
    Organization,
    Product,
    Subscription,
)
from polar.models.billing_entry import BillingEntryDirection, BillingEntryType
from polar.models.event import EventSource
from polar.models.meter_period import MeterPeriodStatus
from polar.postgres import AsyncSession
from polar.subscription.service import subscription as subscription_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    METER_TEST_EVENT,
    create_active_subscription,
    create_event,
    create_meter,
    create_product,
)

PERIOD_START = datetime(2026, 7, 1, tzinfo=UTC)
PERIOD_END = datetime(2026, 8, 1, tzinfo=UTC)


@pytest_asyncio.fixture
async def sum_meter(save_fixture: SaveFixture, organization: Organization) -> Meter:
    return await create_meter(
        save_fixture,
        organization=organization,
        name="Tokens",
        filter=Filter(conjunction=FilterConjunction.and_, clauses=[]),
        aggregation=PropertyAggregation(
            func=AggregationFunction.sum, property="tokens"
        ),
    )


@pytest_asyncio.fixture
async def max_meter(save_fixture: SaveFixture, organization: Organization) -> Meter:
    return await create_meter(
        save_fixture,
        organization=organization,
        name="Seats",
        filter=Filter(conjunction=FilterConjunction.and_, clauses=[]),
        aggregation=PropertyAggregation(func=AggregationFunction.max, property="seats"),
    )


@pytest_asyncio.fixture
async def sum_subscription(
    save_fixture: SaveFixture,
    customer: Customer,
    organization: Organization,
    sum_meter: Meter,
) -> Subscription:
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(sum_meter, Decimal(100), None, "usd")],
    )
    return await create_active_subscription(
        save_fixture,
        customer=customer,
        product=product,
        current_period_start=PERIOD_START,
        current_period_end=PERIOD_END,
    )


@pytest_asyncio.fixture
async def max_subscription(
    save_fixture: SaveFixture,
    customer: Customer,
    organization: Organization,
    max_meter: Meter,
) -> Subscription:
    product: Product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(max_meter, Decimal(15_00), None, "usd")],
    )
    return await create_active_subscription(
        save_fixture,
        customer=customer,
        product=product,
        current_period_start=PERIOD_START,
        current_period_end=PERIOD_END,
    )


async def _usage(
    save_fixture: SaveFixture,
    session: AsyncSession,
    subscription: Subscription,
    *,
    timestamp: datetime,
    metadata: dict[str, Any],
    source: EventSource = EventSource.user,
    name: str | None = None,
) -> BillingEntry:
    """Ingest an event with the billing entry that attributes it to the subscription.

    A period reads its usage through those entries, so a test creating only the event
    would measure nothing.
    """
    customer = subscription.customer
    event = await create_event(
        save_fixture,
        organization=customer.organization,
        customer=customer,
        timestamp=timestamp,
        source=source,
        name=name or METER_TEST_EVENT,
        metadata=metadata,
    )
    entry = BillingEntry(
        start_timestamp=event.timestamp,
        end_timestamp=event.timestamp,
        type=BillingEntryType.metered,
        direction=BillingEntryDirection.debit,
        customer=customer,
        product_price=subscription.subscription_product_prices[0].product_price,
        subscription=subscription,
        event=event,
    )
    session.add(entry)
    await session.flush()
    return entry


async def _credit(
    save_fixture: SaveFixture,
    session: AsyncSession,
    subscription: Subscription,
    meter: Meter,
    *,
    units: int,
    timestamp: datetime,
    rollover: bool = False,
) -> None:
    await _usage(
        save_fixture,
        session,
        subscription,
        timestamp=timestamp,
        source=EventSource.system,
        name=SystemEvent.meter_credited,
        metadata={"meter_id": str(meter.id), "units": units, "rollover": rollover},
    )


async def _open_period(
    session: AsyncSession,
    subscription: Subscription,
    *,
    starts_at: datetime = PERIOD_START,
    ends_at: datetime = PERIOD_END,
) -> MeterPeriod:
    periods = await meter_period_service.open_for_subscription(
        session, subscription, starts_at=starts_at, ends_at=ends_at
    )
    await session.flush()
    repository = MeterPeriodRepository.from_session(session)
    period = await repository.get_by_id(
        periods[0].id, options=repository.get_eager_options()
    )
    assert period is not None
    return period


async def _settle(
    session: AsyncSession,
    period: MeterPeriod,
    *,
    cutoff: datetime,
    close: bool = True,
) -> MeterPeriodSettlement:
    settlement = await meter_period_service.compute_settlement(
        session, period, cutoff=cutoff
    )
    await meter_period_service.apply_settlement(session, settlement, close=close)
    return settlement


@pytest.mark.asyncio
class TestOpenForSubscription:
    async def test_creates_one_period_per_metered_price(
        self, session: AsyncSession, sum_subscription: Subscription, sum_meter: Meter
    ) -> None:
        periods = await meter_period_service.open_for_subscription(
            session, sum_subscription, starts_at=PERIOD_START, ends_at=PERIOD_END
        )

        assert len(periods) == 1
        period = periods[0]
        assert period.meter_id == sum_meter.id
        assert period.starts_at == PERIOD_START
        assert period.ends_at == PERIOD_END
        assert period.status == MeterPeriodStatus.accruing
        assert period.billed_amount == 0
        assert period.currency == "usd"

    async def test_is_idempotent(
        self, session: AsyncSession, sum_subscription: Subscription
    ) -> None:
        first = await meter_period_service.open_for_subscription(
            session, sum_subscription, starts_at=PERIOD_START, ends_at=PERIOD_END
        )
        await session.flush()
        second = await meter_period_service.open_for_subscription(
            session, sum_subscription, starts_at=PERIOD_START, ends_at=PERIOD_END
        )

        assert [period.id for period in first] == [period.id for period in second]


@pytest.mark.asyncio
class TestSettle:
    async def test_aggregates_entries_in_window(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        sum_subscription: Subscription,
    ) -> None:
        for tokens in (10, 20, 30):
            await _usage(
                save_fixture,
                session,
                sum_subscription,
                timestamp=PERIOD_START + timedelta(days=1),
                metadata={"tokens": tokens},
            )
        period = await _open_period(session, sum_subscription)

        settlement = await _settle(session, period, cutoff=PERIOD_END)

        assert settlement.quantity == Decimal(60)
        assert settlement.amount == 60 * 100
        assert settlement.charge == settlement.amount

    async def test_excludes_entries_outside_window(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        sum_subscription: Subscription,
    ) -> None:
        for timestamp in (
            PERIOD_START - timedelta(days=1),
            PERIOD_END + timedelta(days=1),
        ):
            await _usage(
                save_fixture,
                session,
                sum_subscription,
                timestamp=timestamp,
                metadata={"tokens": 100},
            )
        await _usage(
            save_fixture,
            session,
            sum_subscription,
            timestamp=PERIOD_START + timedelta(days=2),
            metadata={"tokens": 7},
        )
        period = await _open_period(session, sum_subscription)

        settlement = await _settle(session, period, cutoff=PERIOD_END)

        assert settlement.quantity == Decimal(7)

    async def test_subtracts_credits(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        sum_meter: Meter,
        sum_subscription: Subscription,
    ) -> None:
        await _usage(
            save_fixture,
            session,
            sum_subscription,
            timestamp=PERIOD_START + timedelta(days=1),
            metadata={"tokens": 30},
        )
        await _credit(
            save_fixture,
            session,
            sum_subscription,
            sum_meter,
            units=20,
            timestamp=PERIOD_START,
        )
        period = await _open_period(session, sum_subscription)

        settlement = await _settle(session, period, cutoff=PERIOD_END)

        assert settlement.quantity == Decimal(30)
        assert settlement.credited_units == Decimal(20)
        assert settlement.amount == 10 * 100

    async def test_interim_settlement_charges_only_the_increase(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        max_meter: Meter,
        max_subscription: Subscription,
    ) -> None:
        """
        A max meter settled twice within a period charges the increase over the peak
        it already billed, and the allowance stays in scope across both.
        """
        await _credit(
            save_fixture,
            session,
            max_subscription,
            max_meter,
            units=10,
            timestamp=PERIOD_START,
        )
        for seats in (10, 10, 12):
            await _usage(
                save_fixture,
                session,
                max_subscription,
                timestamp=PERIOD_START + timedelta(days=1),
                metadata={"seats": seats},
            )
        period = await _open_period(session, max_subscription)

        interim = await _settle(
            session, period, cutoff=PERIOD_START + timedelta(days=2), close=False
        )

        assert interim.quantity == Decimal(12)
        assert interim.credited_units == Decimal(10)
        assert interim.amount == 2 * 15_00
        assert interim.charge == 2 * 15_00
        assert interim.period.status == MeterPeriodStatus.accruing

        for seats in (12, 14, 15):
            await _usage(
                save_fixture,
                session,
                max_subscription,
                timestamp=PERIOD_START + timedelta(days=10),
                metadata={"seats": seats},
            )

        final = await _settle(session, period, cutoff=PERIOD_END)

        assert final.quantity == Decimal(15)
        assert final.credited_units == Decimal(10)
        assert final.amount == 5 * 15_00
        assert final.charge == 3 * 15_00
        assert final.period.status == MeterPeriodStatus.settled

    async def test_resettling_an_unchanged_period_charges_nothing(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        sum_subscription: Subscription,
    ) -> None:
        await _usage(
            save_fixture,
            session,
            sum_subscription,
            timestamp=PERIOD_START + timedelta(days=1),
            metadata={"tokens": 10},
        )
        period = await _open_period(session, sum_subscription)
        first = await _settle(session, period, cutoff=PERIOD_END)
        assert first.charge == 10 * 100

        again = await _settle(session, period, cutoff=PERIOD_END)

        assert again.quantity == Decimal(10)
        assert again.charge == 0


@pytest.mark.asyncio
class TestCreditClamping:
    async def test_a_revoke_cannot_take_back_more_than_was_outstanding(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        sum_meter: Meter,
        sum_subscription: Subscription,
    ) -> None:
        for index, units in enumerate((100, -150, 50)):
            await _credit(
                save_fixture,
                session,
                sum_subscription,
                sum_meter,
                units=units,
                timestamp=PERIOD_START + timedelta(hours=index),
            )
        period = await _open_period(session, sum_subscription)

        credited = await meter_period_service.get_credited_units(
            session, period, cutoff=PERIOD_END
        )

        assert credited == Decimal(50)


@pytest.mark.asyncio
class TestComputeCorrections:
    async def test_late_entry_corrects_its_own_period(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        sum_subscription: Subscription,
    ) -> None:
        """Usage entered after its window was settled is billed on the next invoice,
        at the quantity of the period it happened in."""
        period = await _open_period(session, sum_subscription)
        await _settle(session, period, cutoff=PERIOD_END)

        await _usage(
            save_fixture,
            session,
            sum_subscription,
            timestamp=PERIOD_START + timedelta(days=5),
            metadata={"tokens": 42},
        )

        corrections = await meter_period_service.compute_corrections(
            session, sum_subscription, cutoff=PERIOD_END + timedelta(days=1)
        )

        assert len(corrections) == 1
        assert corrections[0].period.id == period.id
        assert corrections[0].quantity == Decimal(42)
        assert corrections[0].charge == 42 * 100

    async def test_no_drift_produces_no_correction(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        sum_subscription: Subscription,
    ) -> None:
        await _usage(
            save_fixture,
            session,
            sum_subscription,
            timestamp=PERIOD_START + timedelta(days=1),
            metadata={"tokens": 10},
        )
        period = await _open_period(session, sum_subscription)
        await _settle(session, period, cutoff=PERIOD_END)

        corrections = await meter_period_service.compute_corrections(
            session, sum_subscription, cutoff=PERIOD_END + timedelta(days=1)
        )

        assert corrections == []

    async def test_only_the_last_periods_per_meter_are_corrected(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        sum_subscription: Subscription,
    ) -> None:
        """Only the period settled at the previous invoice is rechecked, so an
        older one is final."""
        window = PERIOD_END - PERIOD_START
        for index in range(2):
            starts_at = PERIOD_START + window * index
            period = await _open_period(
                session,
                sum_subscription,
                starts_at=starts_at,
                ends_at=starts_at + window,
            )
            await _settle(session, period, cutoff=starts_at + window)

        await _usage(
            save_fixture,
            session,
            sum_subscription,
            timestamp=PERIOD_START + timedelta(days=5),
            metadata={"tokens": 42},
        )

        corrections = await meter_period_service.compute_corrections(
            session, sum_subscription, cutoff=PERIOD_START + window * 3
        )

        assert corrections == []


@pytest.mark.asyncio
class TestResetMetersOpensPeriods:
    async def test_uses_the_meter_clock_when_set(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        sum_subscription: Subscription,
    ) -> None:
        """A meter interval shorter than the billing interval bounds the period on
        both sides."""
        organization.feature_settings = {"metered_billing_periods_enabled": True}
        await save_fixture(organization)

        meter_period_start = PERIOD_START + timedelta(days=10)
        meter_period_end = PERIOD_START + timedelta(days=20)
        sum_subscription.current_meter_period_start = meter_period_start
        sum_subscription.current_meter_period_end = meter_period_end
        await save_fixture(sum_subscription)

        await subscription_service.reset_meters(session, sum_subscription)
        await session.flush()

        repository = MeterPeriodRepository.from_session(session)
        periods = await repository.get_accruing_by_subscription(sum_subscription.id)
        assert len(periods) == 1
        assert periods[0].starts_at == meter_period_start
        assert periods[0].ends_at == meter_period_end

    async def test_falls_back_to_the_billing_clock(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        sum_subscription: Subscription,
    ) -> None:
        organization.feature_settings = {"metered_billing_periods_enabled": True}
        await save_fixture(organization)
        assert sum_subscription.current_meter_period_start is None

        await subscription_service.reset_meters(session, sum_subscription)
        await session.flush()

        repository = MeterPeriodRepository.from_session(session)
        periods = await repository.get_accruing_by_subscription(sum_subscription.id)
        assert len(periods) == 1
        assert periods[0].starts_at == PERIOD_START
        assert periods[0].ends_at == PERIOD_END


@pytest_asyncio.fixture
async def count_meter(save_fixture: SaveFixture, organization: Organization) -> Meter:
    return await create_meter(
        save_fixture,
        organization=organization,
        name="Tool Calls",
        filter=Filter(conjunction=FilterConjunction.and_, clauses=[]),
        aggregation=CountAggregation(),
    )


@pytest_asyncio.fixture
async def count_subscription(
    save_fixture: SaveFixture,
    customer: Customer,
    organization: Organization,
    count_meter: Meter,
) -> Subscription:
    meter = count_meter
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(meter, Decimal(100), None, "usd")],
    )
    return await create_active_subscription(
        save_fixture,
        customer=customer,
        product=product,
        current_period_start=PERIOD_START,
        current_period_end=PERIOD_END,
    )


@pytest.mark.asyncio
class TestCountMeter:
    async def test_counts_entries_without_reaching_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        count_meter: Meter,
        count_subscription: Subscription,
    ) -> None:
        """A count meter's quantity is its entry count, less the system entries a
        credit or reset produces."""
        for index in range(4):
            await _usage(
                save_fixture,
                session,
                count_subscription,
                timestamp=PERIOD_START + timedelta(hours=index),
                metadata={},
            )
        await _credit(
            save_fixture,
            session,
            count_subscription,
            count_meter,
            units=1,
            timestamp=PERIOD_START,
        )
        period = await _open_period(session, count_subscription)

        settlement = await _settle(session, period, cutoff=PERIOD_END)

        assert settlement.quantity == Decimal(4)
        assert settlement.credited_units == Decimal(1)
        assert settlement.amount == 3 * 100
