from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.dispute.service import DisputePaymentNotFoundError
from polar.dispute.service import dispute as dispute_service
from polar.enums import PaymentProcessor
from polar.models import Customer, Organization
from polar.models.dispute import DisputeStatus
from polar.postgres import AsyncSession
from polar.transaction.service.dispute import DisputeTransactionService
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_dispute, create_order, create_payment
from tests.fixtures.stripe import build_stripe_dispute


@pytest.fixture
def dispute_transaction_service_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch(
        "polar.dispute.service.dispute_transaction_service",
        spec=DisputeTransactionService,
    )


@pytest.mark.asyncio
class TestUpsertFromStripe:
    async def test_not_existing_order(self, session: AsyncSession) -> None:
        stripe_dispute = build_stripe_dispute(
            status="needs_response", balance_transactions=[]
        )

        with pytest.raises(DisputePaymentNotFoundError):
            await dispute_service.upsert_from_stripe(session, stripe_dispute)

    async def test_new(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        charge_id = "STRIPE_CHARGE_ID"
        payment = await create_payment(
            save_fixture, organization, order=order, processor_id=charge_id
        )
        stripe_dispute = build_stripe_dispute(
            status="needs_response",
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[],
        )

        dispute = await dispute_service.upsert_from_stripe(session, stripe_dispute)

        assert dispute.status == DisputeStatus.needs_response
        assert dispute.payment_processor == PaymentProcessor.stripe
        assert dispute.payment_processor_id == stripe_dispute.id
        assert dispute.amount == order.subtotal_amount
        assert dispute.tax_amount == order.tax_amount
        assert dispute.currency == stripe_dispute.currency
        assert dispute.order == order
        assert dispute.payment == payment

    async def test_update(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
        dispute_transaction_service_mock: MagicMock,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        charge_id = "STRIPE_CHARGE_ID"
        payment = await create_payment(
            save_fixture, organization, order=order, processor_id=charge_id
        )
        dispute = await create_dispute(save_fixture, order, payment)
        assert dispute.payment_processor_id is not None

        stripe_dispute = build_stripe_dispute(
            status="lost",
            id=dispute.payment_processor_id,
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[],
        )

        updated_dispute = await dispute_service.upsert_from_stripe(
            session, stripe_dispute
        )

        assert updated_dispute.id == dispute.id
        assert updated_dispute.status == DisputeStatus.lost

        dispute_transaction_service_mock.create_dispute.assert_awaited_once_with(
            session, dispute=updated_dispute
        )
