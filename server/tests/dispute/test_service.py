from datetime import UTC, datetime
from typing import Literal
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.benefit.grant.service import BenefitGrantService
from polar.dispute.dispute_case import dispute_case as dispute_case_service
from polar.dispute.service import DisputePaymentNotFoundError
from polar.dispute.service import dispute as dispute_service
from polar.enums import PaymentProcessor, TaxProcessor
from polar.integrations.chargeback_stop.types import ChargebackStopAlert
from polar.models import Customer, Organization, Product
from polar.models.dispute import DisputeAlertProcessor, DisputeStatus
from polar.models.support_case import DisputeSupportCase, SupportCaseMessageType
from polar.postgres import AsyncSession
from polar.refund.service import RefundService
from polar.support_case.repository import SupportCaseMessageRepository
from polar.tax.calculation.base import AlreadyRevertedError
from polar.transaction.service.dispute import DisputeTransactionService
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_dispute,
    create_order,
    create_payment,
    create_refund,
)
from tests.fixtures.stripe import (
    build_stripe_balance_transaction,
    build_stripe_dispute,
    build_stripe_payment_intent,
)


@pytest.fixture
def dispute_transaction_service_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch(
        "polar.dispute.service.dispute_transaction_service",
        spec=DisputeTransactionService,
    )


@pytest.fixture
def refund_service_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.dispute.service.refund_service", spec=RefundService)


@pytest.fixture
def benefit_grant_service_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch(
        "polar.dispute.service.benefit_grant_service", spec=BenefitGrantService
    )


def build_chargeback_stop_alert(
    *,
    id: str = "CHARGEBACK_STOP_ALERT_ID",
    integration_transaction_id: str = "STRIPE_PAYMENT_INTENT_ID",
    transaction_refund_outcome: Literal["REFUNDED", "NOT_REFUNDED"] = "NOT_REFUNDED",
    transaction_amount_in_cents: int = 1000,
    transaction_currency_code: str = "USD",
) -> ChargebackStopAlert:
    return ChargebackStopAlert(
        id=id,
        created_at="2024-01-01T00:00:00Z",
        updated_at="2024-01-01T00:00:00Z",
        integration_transaction_id=integration_transaction_id,
        transaction_refund_outcome=transaction_refund_outcome,
        transaction_amount_in_cents=transaction_amount_in_cents,
        transaction_currency_code=transaction_currency_code.upper(),
    )


async def _message_types(
    session: AsyncSession, case: DisputeSupportCase
) -> list[SupportCaseMessageType]:
    repository = SupportCaseMessageRepository.from_session(session)
    messages = await repository.list_by_case(case.id)
    return [message.type for message in messages]


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

    async def test_new_captures_stripe_evidence_fields(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        charge_id = "STRIPE_CHARGE_ID"
        await create_payment(
            save_fixture, organization, order=order, processor_id=charge_id
        )
        due_by = int(datetime(2026, 7, 1, 12, 0, tzinfo=UTC).timestamp())
        stripe_dispute = build_stripe_dispute(
            status="needs_response",
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[],
            reason="product_not_received",
            network_reason_code="13.1",
            evidence_due_by=due_by,
            has_evidence=True,
            past_due=False,
            submission_count=2,
        )

        dispute = await dispute_service.upsert_from_stripe(session, stripe_dispute)

        assert dispute.reason == "product_not_received"
        assert dispute.network_reason_code == "13.1"
        assert dispute.evidence_due_by == datetime(2026, 7, 1, 12, 0, tzinfo=UTC)
        assert dispute.has_evidence is True
        assert dispute.past_due is False
        assert dispute.submission_count == 2

    async def test_new_handles_absent_optional_evidence_fields(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        charge_id = "STRIPE_CHARGE_ID"
        await create_payment(
            save_fixture, organization, order=order, processor_id=charge_id
        )
        # Stripe drops network_reason_code and evidence_details.due_by when null,
        # and the SDK raises AttributeError on the missing keys — the upsert must
        # tolerate their absence.
        stripe_dispute = build_stripe_dispute(
            status="needs_response",
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[],
        )

        dispute = await dispute_service.upsert_from_stripe(session, stripe_dispute)

        assert dispute.reason == "fraudulent"
        assert dispute.network_reason_code is None
        assert dispute.evidence_due_by is None

    async def test_update_from_dispute_id(
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
            balance_transactions=[
                build_stripe_balance_transaction(
                    amount=-dispute.amount, reporting_category="dispute", fee=1500
                )
            ],
        )

        updated_dispute = await dispute_service.upsert_from_stripe(
            session, stripe_dispute
        )

        assert updated_dispute.id == dispute.id
        assert updated_dispute.status == DisputeStatus.lost

        dispute_transaction_service_mock.create_dispute.assert_awaited_once_with(
            session, dispute=updated_dispute
        )

    async def test_update_from_matching_payment(
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
        dispute = await create_dispute(
            save_fixture,
            order,
            payment,
            payment_processor_id=None,
            alert_processor=DisputeAlertProcessor.chargeback_stop,
            alert_processor_id="CHARGEBACK_STOP_ALERT_ID",
        )

        stripe_dispute = build_stripe_dispute(
            status="won",
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[],
        )

        updated_dispute = await dispute_service.upsert_from_stripe(
            session, stripe_dispute
        )

        assert updated_dispute.id == dispute.id
        assert updated_dispute.status == DisputeStatus.won
        assert updated_dispute.payment_processor == PaymentProcessor.stripe
        assert updated_dispute.payment_processor_id == stripe_dispute.id

        dispute_transaction_service_mock.create_dispute.assert_awaited_once_with(
            session, dispute=updated_dispute
        )

    async def test_new_rapid_resolution_dispute(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
        dispute_transaction_service_mock: MagicMock,
        refund_service_mock: MagicMock,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        charge_id = "STRIPE_CHARGE_ID"
        payment = await create_payment(
            save_fixture, organization, order=order, processor_id=charge_id
        )
        stripe_dispute_balance_transaction = build_stripe_balance_transaction(
            amount=-order.due_amount,
            reporting_category="dispute",
            fee=0,  # Our heuristic to detect RDR disputes
        )
        stripe_dispute = build_stripe_dispute(
            status="lost",
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[stripe_dispute_balance_transaction],
        )

        dispute = await dispute_service.upsert_from_stripe(session, stripe_dispute)

        assert dispute.status == DisputeStatus.prevented
        assert dispute.payment_processor == PaymentProcessor.stripe
        assert dispute.payment_processor_id == stripe_dispute.id
        assert dispute.amount == order.subtotal_amount
        assert dispute.tax_amount == order.tax_amount
        assert dispute.currency == stripe_dispute.currency
        assert dispute.order == order
        assert dispute.payment == payment

        dispute_transaction_service_mock.create_dispute.assert_not_awaited()
        refund_service_mock.create_from_dispute.assert_awaited_once_with(
            session, dispute, stripe_dispute_balance_transaction.id
        )

    async def test_updated_prevented_dispute(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
        dispute_transaction_service_mock: MagicMock,
        refund_service_mock: MagicMock,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        charge_id = "STRIPE_CHARGE_ID"
        payment = await create_payment(
            save_fixture, organization, order=order, processor_id=charge_id
        )
        dispute = await create_dispute(
            save_fixture,
            order,
            payment,
            status=DisputeStatus.prevented,
            payment_processor=PaymentProcessor.stripe,
            payment_processor_id=None,
            alert_processor=DisputeAlertProcessor.chargeback_stop,
            alert_processor_id="CHARGEBACK_STOP_ALERT_ID",
        )

        stripe_dispute_balance_transaction = build_stripe_balance_transaction(
            amount=-order.due_amount,
            reporting_category="dispute",
            fee=0,  # Our heuristic to detect RDR disputes
        )
        stripe_dispute = build_stripe_dispute(
            status="lost",
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[stripe_dispute_balance_transaction],
        )

        updated_dispute = await dispute_service.upsert_from_stripe(
            session, stripe_dispute
        )

        assert updated_dispute.id == dispute.id
        assert updated_dispute.status == DisputeStatus.prevented
        assert updated_dispute.payment_processor == PaymentProcessor.stripe
        assert updated_dispute.payment_processor_id == stripe_dispute.id

        dispute_transaction_service_mock.create_dispute.assert_not_awaited()
        refund_service_mock.create_from_dispute.assert_awaited_once_with(
            session, dispute, stripe_dispute_balance_transaction.id
        )

    async def test_update_closed_dispute(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
        dispute_transaction_service_mock: MagicMock,
        refund_service_mock: MagicMock,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        charge_id = "STRIPE_CHARGE_ID"
        payment = await create_payment(
            save_fixture, organization, order=order, processor_id=charge_id
        )
        stripe_dispute_balance_transaction = build_stripe_balance_transaction(
            amount=-order.due_amount,
            reporting_category="dispute",
            fee=1500,
        )
        stripe_dispute = build_stripe_dispute(
            status="lost",
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[stripe_dispute_balance_transaction],
        )
        await create_dispute(
            save_fixture,
            order,
            payment,
            status=DisputeStatus.lost,
            payment_processor=PaymentProcessor.stripe,
            payment_processor_id=stripe_dispute.id,
        )

        updated_dispute = await dispute_service.upsert_from_stripe(
            session, stripe_dispute
        )

        assert updated_dispute.status == DisputeStatus.lost

        dispute_transaction_service_mock.create_dispute.assert_not_awaited()
        refund_service_mock.create_from_dispute.assert_not_awaited()

    async def test_update_failed_refund_open_dispute(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
        dispute_transaction_service_mock: MagicMock,
        refund_service_mock: MagicMock,
    ) -> None:
        """
        Check that we handle the case where the alert processor issues a refund
        to prevent the dispute, but a bit too late: the refund fails and the dispute
        is escalated by Stripe.
        """
        order = await create_order(save_fixture, customer=customer)
        charge_id = "STRIPE_CHARGE_ID"
        payment = await create_payment(
            save_fixture, organization, order=order, processor_id=charge_id
        )
        stripe_dispute_balance_transaction = build_stripe_balance_transaction(
            amount=-order.due_amount,
            reporting_category="dispute",
            fee=1500,
        )
        stripe_dispute = build_stripe_dispute(
            status="needs_response",
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[stripe_dispute_balance_transaction],
        )
        await create_dispute(
            save_fixture,
            order,
            payment,
            status=DisputeStatus.prevented,
            payment_processor=PaymentProcessor.stripe,
            payment_processor_id=stripe_dispute.id,
            alert_processor=DisputeAlertProcessor.chargeback_stop,
            alert_processor_id="CHARGEBACK_STOP_ALERT_ID",
        )

        updated_dispute = await dispute_service.upsert_from_stripe(
            session, stripe_dispute
        )

        assert updated_dispute.status == DisputeStatus.needs_response

        dispute_transaction_service_mock.create_dispute.assert_not_awaited()
        refund_service_mock.create_from_dispute.assert_not_awaited()

    async def test_update_closed_rapid_resolution_dispute(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
        dispute_transaction_service_mock: MagicMock,
        refund_service_mock: MagicMock,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        charge_id = "STRIPE_CHARGE_ID"
        payment = await create_payment(
            save_fixture, organization, order=order, processor_id=charge_id
        )
        stripe_dispute_balance_transaction = build_stripe_balance_transaction(
            amount=-order.due_amount,
            reporting_category="dispute",
            fee=0,  # Our heuristic to detect RDR disputes
        )
        stripe_dispute = build_stripe_dispute(
            status="lost",
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[stripe_dispute_balance_transaction],
        )
        dispute = await create_dispute(
            save_fixture,
            order,
            payment,
            status=DisputeStatus.prevented,
            payment_processor=PaymentProcessor.stripe,
            payment_processor_id=stripe_dispute.id,
        )
        await create_refund(save_fixture, order, payment, dispute=dispute)

        updated_dispute = await dispute_service.upsert_from_stripe(
            session, stripe_dispute
        )

        assert updated_dispute.status == DisputeStatus.prevented

        dispute_transaction_service_mock.create_dispute.assert_not_awaited()
        refund_service_mock.create_from_dispute.assert_not_awaited()

    async def test_update_closed_rapid_resolution_dispute_with_failed_refund(
        self,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
        dispute_transaction_service_mock: MagicMock,
        refund_service_mock: MagicMock,
    ) -> None:
        order = await create_order(
            save_fixture,
            customer=customer,
            tax_amount=100,
            tax_processor=TaxProcessor.stripe,
            tax_transaction_processor_id="TAX_TRANSACTION_ID",
        )
        charge_id = "STRIPE_CHARGE_ID"
        payment = await create_payment(
            save_fixture, organization, order=order, processor_id=charge_id
        )
        stripe_dispute_balance_transaction = build_stripe_balance_transaction(
            amount=-order.due_amount,
            reporting_category="dispute",
            fee=0,  # Our heuristic to detect RDR disputes
        )
        stripe_dispute = build_stripe_dispute(
            status="lost",
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[stripe_dispute_balance_transaction],
        )
        dispute = await create_dispute(
            save_fixture,
            order,
            payment,
            status=DisputeStatus.needs_response,
            payment_processor=PaymentProcessor.stripe,
            payment_processor_id=stripe_dispute.id,
        )
        failed_refund = await create_refund(
            save_fixture,
            order,
            payment,
            dispute=dispute,
            status="failed",
            processor_id="REFUND_ID",
        )

        mocker.patch(
            "polar.refund.service.tax_calculation_service.revert",
            side_effect=AlreadyRevertedError(),
        )

        updated_dispute = await dispute_service.upsert_from_stripe(
            session, stripe_dispute
        )

        assert updated_dispute.status == DisputeStatus.prevented

        dispute_transaction_service_mock.create_dispute.assert_not_awaited()
        refund_service_mock.create_from_dispute.assert_awaited()

    async def test_revoke_order(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
        product_one_time: Product,
        benefit_grant_service_mock: MagicMock,
        dispute_transaction_service_mock: MagicMock,
    ) -> None:
        order = await create_order(
            save_fixture, customer=customer, product=product_one_time
        )
        charge_id = "STRIPE_CHARGE_ID"
        await create_payment(
            save_fixture, organization, order=order, processor_id=charge_id
        )
        stripe_dispute = build_stripe_dispute(
            status="lost",
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[],
        )

        await dispute_service.upsert_from_stripe(session, stripe_dispute)

        dispute_transaction_service_mock.create_dispute.assert_awaited_once()
        benefit_grant_service_mock.enqueue_benefits_grants.assert_awaited_once_with(
            session,
            task="revoke",
            customer=customer,
            product=product_one_time,
            order=order,
        )

    async def test_revoke_subscription(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
        product: Product,
        dispute_transaction_service_mock: MagicMock,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        order = await create_order(
            save_fixture, customer=customer, product=product, subscription=subscription
        )
        charge_id = "STRIPE_CHARGE_ID"
        await create_payment(
            save_fixture, organization, order=order, processor_id=charge_id
        )
        stripe_dispute = build_stripe_dispute(
            status="lost",
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[],
        )

        await dispute_service.upsert_from_stripe(session, stripe_dispute)

        dispute_transaction_service_mock.create_dispute.assert_awaited_once()
        assert subscription.status == "canceled"


@pytest.mark.asyncio
class TestUpsertFromStripeDisputeCase:
    async def test_opens_case_when_needs_response(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        charge_id = "STRIPE_CHARGE_ID"
        await create_payment(
            save_fixture, organization, order=order, processor_id=charge_id
        )
        stripe_dispute = build_stripe_dispute(
            status="needs_response",
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[],
        )

        dispute = await dispute_service.upsert_from_stripe(session, stripe_dispute)

        case = await dispute_case_service.get_case(session, dispute)
        assert case is not None
        assert case.dispute_id == dispute.id
        assert await dispute_case_service.is_open(session, case)

    async def test_open_is_idempotent_on_repeated_webhook(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        charge_id = "STRIPE_CHARGE_ID"
        await create_payment(
            save_fixture, organization, order=order, processor_id=charge_id
        )
        stripe_dispute = build_stripe_dispute(
            status="needs_response",
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[],
        )

        dispute = await dispute_service.upsert_from_stripe(session, stripe_dispute)
        first_case = await dispute_case_service.get_case(session, dispute)

        # A retried/duplicate webhook must not raise nor open a second case.
        dispute = await dispute_service.upsert_from_stripe(session, stripe_dispute)
        second_case = await dispute_case_service.get_case(session, dispute)

        assert first_case is not None
        assert second_case is not None
        assert second_case.id == first_case.id

    async def test_does_not_open_case_when_prevented(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
        dispute_transaction_service_mock: MagicMock,
        refund_service_mock: MagicMock,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        charge_id = "STRIPE_CHARGE_ID"
        await create_payment(
            save_fixture, organization, order=order, processor_id=charge_id
        )
        # Rapid-resolution dispute: resolved as prevented, no merchant response
        # is needed, so no case should be opened.
        stripe_dispute = build_stripe_dispute(
            status="lost",
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[
                build_stripe_balance_transaction(
                    amount=-order.due_amount, reporting_category="dispute", fee=0
                )
            ],
        )

        dispute = await dispute_service.upsert_from_stripe(session, stripe_dispute)

        assert dispute.status == DisputeStatus.prevented
        assert await dispute_case_service.get_case(session, dispute) is None

    async def test_closes_case_when_resolved(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
        dispute_transaction_service_mock: MagicMock,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        charge_id = "STRIPE_CHARGE_ID"
        await create_payment(
            save_fixture, organization, order=order, processor_id=charge_id
        )
        needs_response = build_stripe_dispute(
            status="needs_response",
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[],
        )
        dispute = await dispute_service.upsert_from_stripe(session, needs_response)
        case = await dispute_case_service.get_case(session, dispute)
        assert case is not None
        assert await dispute_case_service.is_open(session, case)

        won = build_stripe_dispute(
            status="won",
            id=needs_response.id,
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[],
        )
        dispute = await dispute_service.upsert_from_stripe(session, won)

        assert dispute.status == DisputeStatus.won
        case = await dispute_case_service.get_case(session, dispute)
        assert case is not None
        assert not await dispute_case_service.is_open(session, case)

    async def test_reopens_case_when_dispute_returns_to_needs_response(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
        dispute_transaction_service_mock: MagicMock,
        refund_service_mock: MagicMock,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        charge_id = "STRIPE_CHARGE_ID"
        await create_payment(
            save_fixture, organization, order=order, processor_id=charge_id
        )
        needs_response = build_stripe_dispute(
            status="needs_response",
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[],
        )
        dispute = await dispute_service.upsert_from_stripe(session, needs_response)
        case = await dispute_case_service.get_case(session, dispute)
        assert case is not None
        assert await dispute_case_service.is_open(session, case)

        # Rapid-resolution: dispute becomes prevented and the case is closed.
        prevented = build_stripe_dispute(
            status="lost",
            id=needs_response.id,
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[
                build_stripe_balance_transaction(
                    amount=-order.due_amount, reporting_category="dispute", fee=0
                )
            ],
        )
        dispute = await dispute_service.upsert_from_stripe(session, prevented)
        assert dispute.status == DisputeStatus.prevented
        assert not await dispute_case_service.is_open(session, case)

        # Stripe escalates it back to needs_response: the case must reopen.
        reopened = build_stripe_dispute(
            status="needs_response",
            id=needs_response.id,
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[],
        )
        dispute = await dispute_service.upsert_from_stripe(session, reopened)
        assert dispute.status == DisputeStatus.needs_response
        assert await dispute_case_service.is_open(session, case)

    async def test_posts_under_review_message_on_transition(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        charge_id = "STRIPE_CHARGE_ID"
        await create_payment(
            save_fixture, organization, order=order, processor_id=charge_id
        )
        needs_response = build_stripe_dispute(
            status="needs_response",
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[],
        )
        await dispute_service.upsert_from_stripe(session, needs_response)

        under_review = build_stripe_dispute(
            status="under_review",
            id=needs_response.id,
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[],
        )
        dispute = await dispute_service.upsert_from_stripe(session, under_review)

        case = await dispute_case_service.get_case(session, dispute)
        assert case is not None
        assert await dispute_case_service.is_open(session, case)
        types = await _message_types(session, case)
        assert types.count(SupportCaseMessageType.dispute_under_review) == 1

    async def test_posts_prevented_message_on_prevented_close(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
        dispute_transaction_service_mock: MagicMock,
        refund_service_mock: MagicMock,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        charge_id = "STRIPE_CHARGE_ID"
        await create_payment(
            save_fixture, organization, order=order, processor_id=charge_id
        )
        needs_response = build_stripe_dispute(
            status="needs_response",
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[],
        )
        await dispute_service.upsert_from_stripe(session, needs_response)

        # Rapid-resolution: Stripe reports "lost" with a zero-fee balance txn,
        # which we treat as prevented and close the case.
        prevented = build_stripe_dispute(
            status="lost",
            id=needs_response.id,
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[
                build_stripe_balance_transaction(
                    amount=-order.due_amount, reporting_category="dispute", fee=0
                )
            ],
        )
        dispute = await dispute_service.upsert_from_stripe(session, prevented)
        assert dispute.status == DisputeStatus.prevented

        case = await dispute_case_service.get_case(session, dispute)
        assert case is not None
        assert not await dispute_case_service.is_open(session, case)
        types = await _message_types(session, case)
        # The prevented outcome is on the timeline, before the close.
        assert types.count(SupportCaseMessageType.dispute_prevented) == 1
        assert types.index(SupportCaseMessageType.dispute_prevented) < types.index(
            SupportCaseMessageType.closed
        )

    async def test_under_review_message_not_duplicated_on_retry(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        charge_id = "STRIPE_CHARGE_ID"
        await create_payment(
            save_fixture, organization, order=order, processor_id=charge_id
        )
        needs_response = build_stripe_dispute(
            status="needs_response",
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[],
        )
        await dispute_service.upsert_from_stripe(session, needs_response)
        under_review = build_stripe_dispute(
            status="under_review",
            id=needs_response.id,
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[],
        )
        await dispute_service.upsert_from_stripe(session, under_review)
        dispute = await dispute_service.upsert_from_stripe(session, under_review)

        case = await dispute_case_service.get_case(session, dispute)
        assert case is not None
        types = await _message_types(session, case)
        assert types.count(SupportCaseMessageType.dispute_under_review) == 1

    async def test_posts_won_outcome_then_closes(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
        dispute_transaction_service_mock: MagicMock,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        charge_id = "STRIPE_CHARGE_ID"
        await create_payment(
            save_fixture, organization, order=order, processor_id=charge_id
        )
        needs_response = build_stripe_dispute(
            status="needs_response",
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[],
        )
        await dispute_service.upsert_from_stripe(session, needs_response)

        won = build_stripe_dispute(
            status="won",
            id=needs_response.id,
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[],
        )
        dispute = await dispute_service.upsert_from_stripe(session, won)

        case = await dispute_case_service.get_case(session, dispute)
        assert case is not None
        assert not await dispute_case_service.is_open(session, case)
        types = await _message_types(session, case)
        # Outcome event is recorded before the case is closed.
        assert types.index(SupportCaseMessageType.dispute_won) < types.index(
            SupportCaseMessageType.closed
        )

    async def test_posts_lost_outcome_then_closes(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
        dispute_transaction_service_mock: MagicMock,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        charge_id = "STRIPE_CHARGE_ID"
        await create_payment(
            save_fixture, organization, order=order, processor_id=charge_id
        )
        needs_response = build_stripe_dispute(
            status="needs_response",
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[],
        )
        await dispute_service.upsert_from_stripe(session, needs_response)

        lost = build_stripe_dispute(
            status="lost",
            id=needs_response.id,
            charge_id=charge_id,
            amount=order.subtotal_amount + order.tax_amount,
            balance_transactions=[
                build_stripe_balance_transaction(
                    amount=-order.due_amount, reporting_category="dispute", fee=1500
                )
            ],
        )
        dispute = await dispute_service.upsert_from_stripe(session, lost)

        case = await dispute_case_service.get_case(session, dispute)
        assert case is not None
        assert not await dispute_case_service.is_open(session, case)
        types = await _message_types(session, case)
        assert types.index(SupportCaseMessageType.dispute_lost) < types.index(
            SupportCaseMessageType.closed
        )


@pytest.mark.asyncio
class TestUpsertFromChargebackStop:
    async def test_not_existing_order(
        self, session: AsyncSession, mocker: MockerFixture
    ) -> None:
        charge_id = "STRIPE_CHARGE_ID"
        payment_intent_id = "STRIPE_PAYMENT_INTENT_ID"
        payment_intent = build_stripe_payment_intent(
            id=payment_intent_id, latest_charge=charge_id
        )
        mocker.patch(
            "polar.dispute.service.stripe_service.get_payment_intent",
            return_value=payment_intent,
        )

        alert = build_chargeback_stop_alert(
            integration_transaction_id=payment_intent_id
        )

        with pytest.raises(DisputePaymentNotFoundError):
            await dispute_service.upsert_from_chargeback_stop(session, alert)

    async def test_late_alert_does_not_downgrade_escalated_dispute(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        """A ChargebackStop alert that lags behind Stripe must not de-escalate a
        dispute Stripe has already opened: it's no longer an early warning."""
        order = await create_order(
            save_fixture, customer=customer, subtotal_amount=1000, tax_amount=200
        )
        charge_id = "STRIPE_CHARGE_ID"
        payment_intent_id = "STRIPE_PAYMENT_INTENT_ID"
        payment = await create_payment(
            save_fixture, organization, amount=1200, order=order, processor_id=charge_id
        )
        # Stripe already opened the dispute, so it carries a processor id and a
        # live (non-early) status before the alert arrives.
        dispute = await create_dispute(
            save_fixture,
            order,
            payment,
            status=DisputeStatus.needs_response,
            amount=1000,
            tax_amount=200,
            currency="usd",
            payment_processor_id="STRIPE_DISPUTE_ID",
        )
        payment_intent = build_stripe_payment_intent(
            id=payment_intent_id, latest_charge=charge_id
        )
        mocker.patch(
            "polar.dispute.service.stripe_service.get_payment_intent",
            return_value=payment_intent,
        )

        alert = build_chargeback_stop_alert(
            integration_transaction_id=payment_intent_id,
            transaction_refund_outcome="NOT_REFUNDED",
            transaction_amount_in_cents=1200,
            transaction_currency_code="usd",
        )

        updated_dispute = await dispute_service.upsert_from_chargeback_stop(
            session, alert
        )

        assert updated_dispute.id == dispute.id
        assert updated_dispute.status == DisputeStatus.needs_response
        assert updated_dispute.payment_processor_id == "STRIPE_DISPUTE_ID"
        # The alert is still recorded against the existing dispute.
        assert (
            updated_dispute.dispute_alert_processor
            == DisputeAlertProcessor.chargeback_stop
        )
        assert updated_dispute.dispute_alert_processor_id == alert["id"]

    async def test_new_not_refunded(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        order = await create_order(
            save_fixture, customer=customer, subtotal_amount=1000, tax_amount=200
        )
        charge_id = "STRIPE_CHARGE_ID"
        payment_intent_id = "STRIPE_PAYMENT_INTENT_ID"
        payment = await create_payment(
            save_fixture, organization, amount=1200, order=order, processor_id=charge_id
        )
        payment_intent = build_stripe_payment_intent(
            id=payment_intent_id, latest_charge=charge_id
        )
        mocker.patch(
            "polar.dispute.service.stripe_service.get_payment_intent",
            return_value=payment_intent,
        )

        alert = build_chargeback_stop_alert(
            integration_transaction_id=payment_intent_id,
            transaction_refund_outcome="NOT_REFUNDED",
            transaction_amount_in_cents=1200,
            transaction_currency_code="usd",
        )

        dispute = await dispute_service.upsert_from_chargeback_stop(session, alert)

        assert dispute.status == DisputeStatus.early_warning
        assert dispute.payment_processor == PaymentProcessor.stripe
        assert dispute.payment_processor_id is None
        assert dispute.dispute_alert_processor == DisputeAlertProcessor.chargeback_stop
        assert dispute.dispute_alert_processor_id == alert["id"]
        assert dispute.amount == 1000
        assert dispute.tax_amount == 200
        assert dispute.currency == "usd"
        assert dispute.order == order
        assert dispute.payment == payment

    async def test_new_refunded(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        order = await create_order(
            save_fixture, customer=customer, subtotal_amount=1000, tax_amount=200
        )
        charge_id = "STRIPE_CHARGE_ID"
        payment_intent_id = "STRIPE_PAYMENT_INTENT_ID"
        payment = await create_payment(
            save_fixture, organization, amount=1200, order=order, processor_id=charge_id
        )
        payment_intent = build_stripe_payment_intent(
            id=payment_intent_id, latest_charge=charge_id
        )
        mocker.patch(
            "polar.dispute.service.stripe_service.get_payment_intent",
            return_value=payment_intent,
        )

        alert = build_chargeback_stop_alert(
            integration_transaction_id=payment_intent_id,
            transaction_refund_outcome="REFUNDED",
            transaction_amount_in_cents=1200,
            transaction_currency_code="USD",
        )

        dispute = await dispute_service.upsert_from_chargeback_stop(session, alert)

        assert dispute.status == DisputeStatus.prevented
        assert dispute.payment_processor == PaymentProcessor.stripe
        assert dispute.payment_processor_id is None
        assert dispute.dispute_alert_processor == DisputeAlertProcessor.chargeback_stop
        assert dispute.dispute_alert_processor_id == alert["id"]
        assert dispute.amount == 1000
        assert dispute.tax_amount == 200
        assert dispute.currency == "usd"
        assert dispute.order == order
        assert dispute.payment == payment

    async def test_update_existing_dispute(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        charge_id = "STRIPE_CHARGE_ID"
        payment_intent_id = "STRIPE_PAYMENT_INTENT_ID"
        payment = await create_payment(
            save_fixture, organization, order=order, processor_id=charge_id
        )
        dispute = await create_dispute(
            save_fixture, order, payment, payment_processor_id="STRIPE_DISPUTE_ID"
        )
        payment_intent = build_stripe_payment_intent(
            id=payment_intent_id, latest_charge=charge_id
        )
        mocker.patch(
            "polar.dispute.service.stripe_service.get_payment_intent",
            return_value=payment_intent,
        )

        alert = build_chargeback_stop_alert(
            id="CHARGEBACK_STOP_ALERT_ID",
            integration_transaction_id=payment_intent_id,
            transaction_refund_outcome="REFUNDED",
        )

        updated_dispute = await dispute_service.upsert_from_chargeback_stop(
            session, alert
        )

        assert updated_dispute.id == dispute.id
        assert updated_dispute.status == DisputeStatus.prevented
        assert (
            updated_dispute.dispute_alert_processor
            == DisputeAlertProcessor.chargeback_stop
        )
        assert updated_dispute.dispute_alert_processor_id == alert["id"]
