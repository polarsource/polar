import pytest

from polar.kit.db.postgres import AsyncSession
from polar.models import Customer, Product
from polar.models.subscription import SubscriptionStatus
from scripts.backfill_customer_default_payment_method import (
    backfill_statement,
    missing_default_count_statement,
)
from scripts.helper import run_batched_update
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_payment_method,
    create_subscription,
)


async def _backfill(session: AsyncSession) -> int:
    return await run_batched_update(
        backfill_statement(), batch_size=5000, sleep_seconds=0, session=session
    )


async def _count(session: AsyncSession) -> int:
    result = await session.execute(missing_default_count_statement())
    return result.scalar_one()


@pytest.mark.anyio
class TestBackfillCustomerDefaultPaymentMethod:
    async def test_sets_active_subscription_payment_method(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        payment_method = await create_payment_method(save_fixture, customer)
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            payment_method=payment_method,
        )

        assert await _count(session) == 1
        assert await _backfill(session) == 1

        await session.refresh(customer)
        assert customer.default_payment_method_id == payment_method.id

    async def test_picks_most_recent_active_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        older = await create_payment_method(save_fixture, customer)
        newer = await create_payment_method(save_fixture, customer)
        await create_active_subscription(
            save_fixture, product=product, customer=customer, payment_method=older
        )
        await create_active_subscription(
            save_fixture, product=product, customer=customer, payment_method=newer
        )

        assert await _backfill(session) == 1

        await session.refresh(customer)
        assert customer.default_payment_method_id == newer.id

    async def test_keeps_existing_default(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        existing_default = await create_payment_method(save_fixture, customer)
        customer.default_payment_method = existing_default
        await save_fixture(customer)
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            payment_method=await create_payment_method(save_fixture, customer),
        )

        assert await _count(session) == 0
        assert await _backfill(session) == 0

        await session.refresh(customer)
        assert customer.default_payment_method_id == existing_default.id

    @pytest.mark.parametrize(
        "status", [SubscriptionStatus.canceled, SubscriptionStatus.past_due]
    )
    async def test_ignores_inactive_subscription(
        self,
        status: SubscriptionStatus,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=status,
            payment_method=await create_payment_method(save_fixture, customer),
        )

        assert await _count(session) == 0
        assert await _backfill(session) == 0

    async def test_ignores_deleted_payment_method(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        payment_method = await create_payment_method(save_fixture, customer)
        payment_method.set_deleted_at()
        await save_fixture(payment_method)
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            payment_method=payment_method,
        )

        assert await _count(session) == 0
        assert await _backfill(session) == 0

    async def test_ignores_payment_method_of_another_customer(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        customer_second: Customer,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            payment_method=await create_payment_method(save_fixture, customer_second),
        )

        assert await _count(session) == 0
        assert await _backfill(session) == 0
