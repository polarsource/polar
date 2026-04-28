import pytest

from polar.kit.db.postgres import AsyncSession
from polar.models import Account, Customer, Organization
from polar.receipt.service import receipt as receipt_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_order,
    create_organization,
    create_payment,
)


@pytest.mark.asyncio
class TestAllocate:
    async def test_no_op_when_flag_off(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        await create_payment(save_fixture, organization, order=order)

        result = await receipt_service.allocate(session, order)

        assert result.receipt_number is None

    async def test_no_op_when_no_succeeded_payment(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        organization = await create_organization(
            save_fixture, account, feature_settings={"receipts_enabled": True}
        )
        customer = await create_customer(
            save_fixture, organization=organization, email="rcpt@example.com"
        )
        order = await create_order(save_fixture, customer=customer)
        # No payment created.

        result = await receipt_service.allocate(session, order)

        assert result.receipt_number is None

    async def test_allocates_when_enabled_and_paid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        organization = await create_organization(
            save_fixture, account, feature_settings={"receipts_enabled": True}
        )
        customer = await create_customer(
            save_fixture, organization=organization, email="rcpt2@example.com"
        )
        order = await create_order(save_fixture, customer=customer)
        await create_payment(save_fixture, organization, order=order)

        result = await receipt_service.allocate(session, order)

        assert result.receipt_number is not None
        assert result.receipt_number.startswith(f"RCPT-{customer.short_id_str}-")
        assert result.receipt_number.endswith("0001")

        await session.refresh(customer)
        assert customer.receipt_next_number == 2

    async def test_idempotent_on_already_allocated_order(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        organization = await create_organization(
            save_fixture, account, feature_settings={"receipts_enabled": True}
        )
        customer = await create_customer(
            save_fixture, organization=organization, email="rcpt3@example.com"
        )
        order = await create_order(save_fixture, customer=customer)
        await create_payment(save_fixture, organization, order=order)

        first = await receipt_service.allocate(session, order)
        first_number = first.receipt_number
        assert first_number is not None

        # Second call must be a no-op.
        second = await receipt_service.allocate(session, order)
        assert second.receipt_number == first_number

        await session.refresh(customer)
        # Counter only advanced once.
        assert customer.receipt_next_number == 2
