import pytest
from sqlalchemy import select

from polar.kit.db.postgres import AsyncSession
from polar.models import Order, Organization, Product
from scripts.backfill_order_billing_name import run_backfill
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer, create_order


async def _get_billing_name(session: AsyncSession, order: Order) -> str | None:
    result = await session.execute(
        select(Order.billing_name).where(Order.id == order.id)
    )
    return result.scalar_one()


@pytest.mark.asyncio
class TestBackfillOrderBillingName:
    async def test_backfills_from_customer_name(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, name="John Doe"
        )
        order = await create_order(
            save_fixture, customer=customer, product=product, billing_name=None
        )

        updated = await run_backfill(batch_size=10, session=session)

        assert updated == 1
        assert await _get_billing_name(session, order) == "John Doe"

    async def test_prefers_customer_billing_name(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            name="John Doe",
            billing_name="ACME Corp Inc.",
        )
        order = await create_order(
            save_fixture, customer=customer, product=product, billing_name=None
        )

        updated = await run_backfill(batch_size=10, session=session)

        assert updated == 1
        assert await _get_billing_name(session, order) == "ACME Corp Inc."

    async def test_does_not_overwrite_existing_billing_name(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, name="John Doe"
        )
        order = await create_order(
            save_fixture,
            customer=customer,
            product=product,
            billing_name="Already Set",
        )

        updated = await run_backfill(batch_size=10, session=session)

        assert updated == 0
        assert await _get_billing_name(session, order) == "Already Set"

    async def test_skips_order_when_customer_has_no_name(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        customer.name = None
        await save_fixture(customer)
        order = await create_order(
            save_fixture, customer=customer, product=product, billing_name=None
        )

        updated = await run_backfill(batch_size=10, session=session)

        assert updated == 0
        assert await _get_billing_name(session, order) is None

    async def test_is_idempotent(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, name="John Doe"
        )
        order = await create_order(
            save_fixture, customer=customer, product=product, billing_name=None
        )

        first_run = await run_backfill(batch_size=10, session=session)
        second_run = await run_backfill(batch_size=10, session=session)

        assert first_run == 1
        assert second_run == 0
        assert await _get_billing_name(session, order) == "John Doe"
