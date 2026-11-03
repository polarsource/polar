from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import update

from polar.billing_interval.repository import BillingIntervalRepository
from polar.billing_interval.service import BILL_USAGE_LOCK_TIMEOUT
from polar.billing_interval.service import billing_interval as billing_interval_service
from polar.models import Customer, Meter, Product
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from polar.reducer.service import reducer as reducer_service
from polar.reducer.types import UsageWindow
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_subscription

EARLIER = datetime(2026, 1, 1, tzinfo=UTC)
LATER = datetime(2026, 1, 5, tzinfo=UTC)
CUTOFF = datetime(2026, 1, 10, tzinfo=UTC)


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
