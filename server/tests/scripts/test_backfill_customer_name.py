from datetime import UTC, datetime

import pytest
from sqlalchemy import select

from polar.kit.db.postgres import AsyncSession
from polar.models import Checkout, Customer, Organization, Product
from polar.models.checkout import CheckoutStatus
from scripts.backfill_customer_name import run_backfill
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_checkout, create_customer


async def _nameless_customer(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    billing_name: str | None = None,
) -> Customer:
    customer = await create_customer(
        save_fixture, organization=organization, billing_name=billing_name
    )
    customer.name = None
    await save_fixture(customer)
    return customer


async def _checkout(
    save_fixture: SaveFixture,
    product: Product,
    customer: Customer,
    *,
    status: CheckoutStatus = CheckoutStatus.succeeded,
    customer_name: str | None = None,
    customer_billing_name: str | None = None,
    created_at: datetime | None = None,
) -> Checkout:
    checkout = await create_checkout(
        save_fixture,
        products=[product],
        customer=customer,
        status=status,
        created_at=created_at,
    )
    checkout.customer_name = customer_name
    checkout.customer_billing_name = customer_billing_name
    await save_fixture(checkout)
    return checkout


async def _get_name(session: AsyncSession, customer: Customer) -> str | None:
    result = await session.execute(
        select(Customer.name).where(Customer.id == customer.id)
    )
    return result.scalar_one()


@pytest.mark.asyncio
class TestBackfillCustomerName:
    async def test_backfills_name_from_succeeded_checkout(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await _nameless_customer(save_fixture, organization)
        await _checkout(save_fixture, product, customer, customer_name="John Doe")

        updated = await run_backfill(batch_size=10, session=session)

        assert updated == 1
        assert await _get_name(session, customer) == "John Doe"

    async def test_prefers_billing_name_over_cardholder_name(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await _nameless_customer(save_fixture, organization)
        await _checkout(
            save_fixture,
            product,
            customer,
            customer_name="Cardholder Name",
            customer_billing_name="ACME Corp Inc.",
        )

        updated = await run_backfill(batch_size=10, session=session)

        assert updated == 1
        assert await _get_name(session, customer) == "ACME Corp Inc."

    async def test_uses_earliest_succeeded_checkout(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await _nameless_customer(save_fixture, organization)
        await _checkout(
            save_fixture,
            product,
            customer,
            customer_name="Later Name",
            created_at=datetime(2026, 2, 1, tzinfo=UTC),
        )
        await _checkout(
            save_fixture,
            product,
            customer,
            customer_name="Earliest Name",
            created_at=datetime(2026, 1, 1, tzinfo=UTC),
        )

        updated = await run_backfill(batch_size=10, session=session)

        assert updated == 1
        assert await _get_name(session, customer) == "Earliest Name"

    async def test_does_not_overwrite_existing_name(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, name="Existing Person"
        )
        await _checkout(save_fixture, product, customer, customer_name="Cardholder")

        updated = await run_backfill(batch_size=10, session=session)

        assert updated == 0
        assert await _get_name(session, customer) == "Existing Person"

    async def test_ignores_non_succeeded_checkout(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await _nameless_customer(save_fixture, organization)
        await _checkout(
            save_fixture,
            product,
            customer,
            status=CheckoutStatus.open,
            customer_name="Never Paid",
        )

        updated = await run_backfill(batch_size=10, session=session)

        assert updated == 0
        assert await _get_name(session, customer) is None

    async def test_ignores_checkout_without_name(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await _nameless_customer(save_fixture, organization)
        await _checkout(save_fixture, product, customer, customer_name=None)

        updated = await run_backfill(batch_size=10, session=session)

        assert updated == 0
        assert await _get_name(session, customer) is None

    async def test_is_idempotent(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await _nameless_customer(save_fixture, organization)
        await _checkout(save_fixture, product, customer, customer_name="John Doe")

        first_run = await run_backfill(batch_size=10, session=session)
        second_run = await run_backfill(batch_size=10, session=session)

        assert first_run == 1
        assert second_run == 0
        assert await _get_name(session, customer) == "John Doe"
