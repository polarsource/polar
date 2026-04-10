"""
Tests for PaymentAnalyticsService to ensure monetary amounts are returned
in USD cents via Transaction records rather than summing presentment currency
amounts directly from Payment, Refund, or Dispute records.
"""

import pytest

from polar.backoffice.organizations.analytics import PaymentAnalyticsService
from polar.models import Account
from polar.models.dispute import DisputeStatus
from polar.models.payment import PaymentStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_dispute,
    create_dispute_transaction,
    create_order,
    create_organization,
    create_payment,
    create_payment_transaction,
    create_refund,
    create_refund_transaction,
)


@pytest.mark.asyncio
class TestGetSucceededPaymentsStats:
    async def test_uses_transaction_amount_in_usd(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """
        When a payment is made in a non-USD currency, the total amount returned
        should be the USD amount from the Transaction, not the presentment currency
        amount from Payment.
        """
        org = await create_organization(save_fixture, account)
        # Payment in EUR: 900 EUR cents
        payment = await create_payment(
            save_fixture,
            org,
            amount=900,
            currency="eur",
            status=PaymentStatus.succeeded,
        )
        # Transaction in USD: 1000 USD cents (after currency conversion)
        await create_payment_transaction(
            save_fixture,
            amount=1000,
            currency="usd",
            charge_id=payment.processor_id,
        )

        service = PaymentAnalyticsService(session)
        count, total_amount = await service.get_succeeded_payments_stats(org.id)

        assert count == 1
        assert total_amount == 1000  # USD, not 900 EUR

    async def test_no_payments(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        org = await create_organization(save_fixture, account)
        service = PaymentAnalyticsService(session)
        count, total_amount = await service.get_succeeded_payments_stats(org.id)
        assert count == 0
        assert total_amount == 0

    async def test_only_counts_succeeded_payments(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        org = await create_organization(save_fixture, account)
        failed_payment = await create_payment(
            save_fixture, org, amount=1000, currency="usd", status=PaymentStatus.failed
        )
        await create_payment_transaction(
            save_fixture, amount=1000, charge_id=failed_payment.processor_id
        )
        service = PaymentAnalyticsService(session)
        count, total_amount = await service.get_succeeded_payments_stats(org.id)
        assert count == 0
        assert total_amount == 0


@pytest.mark.asyncio
class TestGetRiskScores:
    async def test_includes_succeeded_and_failed(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """Risk scores should include both succeeded and failed payments."""
        org = await create_organization(save_fixture, account)
        await create_payment(
            save_fixture, org, status=PaymentStatus.succeeded, risk_score=5
        )
        await create_payment(
            save_fixture, org, status=PaymentStatus.failed, risk_score=20
        )

        service = PaymentAnalyticsService(session)
        risk_scores = await service.get_risk_scores(org.id)

        assert sorted(risk_scores) == [5, 20]

    async def test_excludes_null_risk_scores(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        org = await create_organization(save_fixture, account)
        await create_payment(
            save_fixture, org, status=PaymentStatus.succeeded, risk_score=3
        )
        await create_payment(
            save_fixture, org, status=PaymentStatus.failed, risk_score=None
        )

        service = PaymentAnalyticsService(session)
        risk_scores = await service.get_risk_scores(org.id)

        assert risk_scores == [3]

    async def test_no_payments(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        org = await create_organization(save_fixture, account)
        service = PaymentAnalyticsService(session)
        risk_scores = await service.get_risk_scores(org.id)
        assert risk_scores == []


@pytest.mark.asyncio
class TestGetRefundStats:
    async def test_uses_transaction_amount_in_usd(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """
        When a refund is in a non-USD currency, the total refund amount returned
        should be the USD amount from the Transaction (negated), not the
        presentment currency amount from Refund.
        """
        org = await create_organization(save_fixture, account)
        customer = await create_customer(
            save_fixture, organization=org, stripe_customer_id="STRIPE_CUST_REFUND"
        )
        order = await create_order(save_fixture, customer=customer)
        payment = await create_payment(
            save_fixture,
            org,
            amount=900,
            currency="eur",
            status=PaymentStatus.succeeded,
        )
        # Refund in EUR: 900 EUR cents
        refund = await create_refund(
            save_fixture, order, payment, amount=900, currency="eur"
        )
        # Refund transaction in USD: -1000 USD cents (negative because money goes out)
        await create_refund_transaction(save_fixture, amount=-1000, refund=refund)

        service = PaymentAnalyticsService(session)
        count, refund_amount = await service.get_refund_stats(org.id)

        assert count == 1
        assert refund_amount == 1000  # USD, not 900 EUR

    async def test_multiple_refunds_on_same_order_counts_as_one(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """
        When an order has multiple refunds (e.g. partial + remainder),
        the count should reflect one refunded order, not the number of
        refund records. The total amount should still sum all refunds.
        """
        org = await create_organization(save_fixture, account)
        customer = await create_customer(
            save_fixture, organization=org, stripe_customer_id="STRIPE_CUST_SPLIT"
        )
        order = await create_order(save_fixture, customer=customer)
        payment = await create_payment(
            save_fixture,
            org,
            amount=1100,
            currency="usd",
            status=PaymentStatus.succeeded,
        )
        # First partial refund
        refund1 = await create_refund(
            save_fixture,
            order,
            payment,
            amount=999,
            currency="usd",
            processor_id="STRIPE_REFUND_1",
        )
        await create_refund_transaction(save_fixture, amount=-999, refund=refund1)
        # Second refund (remainder) on the same order
        refund2 = await create_refund(
            save_fixture,
            order,
            payment,
            amount=101,
            currency="usd",
            processor_id="STRIPE_REFUND_2",
        )
        await create_refund_transaction(save_fixture, amount=-101, refund=refund2)

        service = PaymentAnalyticsService(session)
        count, refund_amount = await service.get_refund_stats(org.id)

        assert count == 1  # One order, not two refund records
        assert refund_amount == 1100  # Total amount across both refunds

    async def test_refunds_on_different_orders_counted_separately(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """
        Refunds on different orders should each be counted.
        """
        org = await create_organization(save_fixture, account)
        customer = await create_customer(
            save_fixture, organization=org, stripe_customer_id="STRIPE_CUST_MULTI"
        )
        order1 = await create_order(save_fixture, customer=customer)
        payment1 = await create_payment(
            save_fixture,
            org,
            amount=500,
            currency="usd",
            status=PaymentStatus.succeeded,
            processor_id="STRIPE_PAY_1",
        )
        refund1 = await create_refund(
            save_fixture,
            order1,
            payment1,
            amount=500,
            currency="usd",
            processor_id="STRIPE_REFUND_A",
        )
        await create_refund_transaction(save_fixture, amount=-500, refund=refund1)

        order2 = await create_order(save_fixture, customer=customer)
        payment2 = await create_payment(
            save_fixture,
            org,
            amount=300,
            currency="usd",
            status=PaymentStatus.succeeded,
            processor_id="STRIPE_PAY_2",
        )
        refund2 = await create_refund(
            save_fixture,
            order2,
            payment2,
            amount=300,
            currency="usd",
            processor_id="STRIPE_REFUND_B",
        )
        await create_refund_transaction(save_fixture, amount=-300, refund=refund2)

        service = PaymentAnalyticsService(session)
        count, refund_amount = await service.get_refund_stats(org.id)

        assert count == 2  # Two distinct orders
        assert refund_amount == 800

    async def test_no_refunds(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        org = await create_organization(save_fixture, account)
        service = PaymentAnalyticsService(session)
        count, refund_amount = await service.get_refund_stats(org.id)
        assert count == 0
        assert refund_amount == 0


@pytest.mark.asyncio
class TestGetDisputeStats:
    async def test_uses_transaction_amount_in_usd(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """
        When a dispute is in a non-USD currency, the total dispute amount returned
        should be the USD amount from the Transaction (negated), not the
        presentment currency amount from Dispute.
        """
        org = await create_organization(save_fixture, account)
        customer = await create_customer(
            save_fixture, organization=org, stripe_customer_id="STRIPE_CUST_DISPUTE"
        )
        order = await create_order(save_fixture, customer=customer)
        payment = await create_payment(
            save_fixture,
            org,
            amount=900,
            currency="eur",
            status=PaymentStatus.succeeded,
        )
        # Dispute in EUR: 900 EUR cents
        dispute = await create_dispute(
            save_fixture,
            order,
            payment,
            amount=900,
            currency="eur",
            status=DisputeStatus.needs_response,
        )
        # Dispute transaction in USD: -1000 USD cents (negative because money is held back)
        await create_dispute_transaction(
            save_fixture, dispute, amount=-1000, currency="usd"
        )

        service = PaymentAnalyticsService(session)
        dispute_count, dispute_amount, _, _ = await service.get_dispute_stats(org.id)

        assert dispute_count == 1
        assert dispute_amount == 1000  # USD, not 900 EUR

    async def test_chargeback_uses_transaction_amount_in_usd(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        org = await create_organization(save_fixture, account)
        customer = await create_customer(
            save_fixture,
            organization=org,
            stripe_customer_id="STRIPE_CUST_CHARGEBACK",
        )
        order = await create_order(save_fixture, customer=customer)
        payment = await create_payment(
            save_fixture,
            org,
            amount=900,
            currency="eur",
            status=PaymentStatus.succeeded,
        )
        dispute = await create_dispute(
            save_fixture,
            order,
            payment,
            amount=900,
            currency="eur",
            status=DisputeStatus.lost,
        )
        await create_dispute_transaction(
            save_fixture, dispute, amount=-1000, currency="usd"
        )

        service = PaymentAnalyticsService(session)
        _, _, chargeback_count, chargeback_amount = await service.get_dispute_stats(
            org.id
        )

        assert chargeback_count == 1
        assert chargeback_amount == 1000  # USD, not 900 EUR

    async def test_no_disputes(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        org = await create_organization(save_fixture, account)
        service = PaymentAnalyticsService(session)
        (
            dispute_count,
            dispute_amount,
            chargeback_count,
            chargeback_amount,
        ) = await service.get_dispute_stats(org.id)
        assert dispute_count == 0
        assert dispute_amount == 0
        assert chargeback_count == 0
        assert chargeback_amount == 0
