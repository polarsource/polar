import pytest

from polar.event.repository import EventRepository
from polar.event.system import SystemEvent
from polar.kit.db.postgres import AsyncSession
from polar.models import Event, Organization, Product, Transaction
from polar.models.event import EventSource
from polar.models.transaction import PlatformFeeType, TransactionType
from scripts.backfill_balance_events import (
    create_missing_balance_dispute_events,
    create_missing_balance_dispute_reversal_events,
    create_missing_balance_order_events,
    create_missing_balance_refund_events,
    create_missing_balance_refund_reversal_events,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_dispute,
    create_dispute_transaction,
    create_order,
    create_payment,
    create_payment_transaction,
    create_refund,
    create_refund_transaction,
)


@pytest.mark.asyncio
class TestCreateMissingBalanceOrderEvents:
    async def test_creates_events_for_payment_transactions_without_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
        )
        payment_transaction = await create_payment_transaction(
            save_fixture,
            order=order,
        )

        created = await create_missing_balance_order_events(
            session, batch_size=10, rate_limit_delay=0
        )

        assert created == 1

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_name(SystemEvent.balance_order)

        assert len(events) == 1
        event = events[0]
        assert event.customer_id == customer.id
        assert event.organization_id == organization.id
        assert event.user_metadata["transaction_id"] == str(payment_transaction.id)
        assert event.user_metadata["order_id"] == str(order.id)
        assert event.user_metadata["product_id"] == str(product.id)
        assert event.user_metadata["amount"] == payment_transaction.amount
        assert event.user_metadata["currency"] == payment_transaction.currency
        assert event.user_metadata["tax_amount"] == order.tax_amount
        assert event.user_metadata["fee"] == 0

    async def test_uses_order_platform_fee_amount(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
        )
        order.platform_fee_amount = 75
        await save_fixture(order)

        payment_transaction = await create_payment_transaction(
            save_fixture,
            order=order,
        )

        created = await create_missing_balance_order_events(
            session, batch_size=10, rate_limit_delay=0
        )

        assert created == 1

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_name(SystemEvent.balance_order)

        assert len(events) == 1
        event = events[0]
        assert event.user_metadata["fee"] == 75

    async def test_skips_transactions_with_existing_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
        )
        payment_transaction = await create_payment_transaction(
            save_fixture,
            order=order,
        )

        existing_event = Event(
            name=SystemEvent.balance_order,
            source=EventSource.system,
            customer_id=customer.id,
            organization_id=organization.id,
            user_metadata={
                "transaction_id": str(payment_transaction.id),
                "order_id": str(order.id),
                "product_id": str(product.id),
                "amount": payment_transaction.amount,
                "currency": payment_transaction.currency,
            },
        )
        await save_fixture(existing_event)

        created = await create_missing_balance_order_events(
            session, batch_size=10, rate_limit_delay=0
        )

        assert created == 0

    async def test_skips_transactions_without_order(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        payment_transaction = await create_payment_transaction(
            save_fixture,
            order=None,
        )

        created = await create_missing_balance_order_events(
            session, batch_size=10, rate_limit_delay=0
        )

        assert created == 0


@pytest.mark.asyncio
class TestCreateMissingBalanceRefundEvents:
    async def test_creates_events_for_refund_transactions_without_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
        )
        payment = await create_payment(save_fixture, organization, order=order)
        refund = await create_refund(save_fixture, order=order, payment=payment)
        refund_transaction = await create_refund_transaction(
            save_fixture,
            refund=refund,
            order=order,
        )

        created = await create_missing_balance_refund_events(
            session, batch_size=10, rate_limit_delay=0
        )

        assert created == 1

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_name(SystemEvent.balance_refund)

        assert len(events) == 1
        event = events[0]
        assert event.customer_id == customer.id
        assert event.organization_id == organization.id
        assert event.user_metadata["transaction_id"] == str(refund_transaction.id)
        assert event.user_metadata["refund_id"] == str(refund.id)
        assert event.user_metadata["order_id"] == str(order.id)
        assert event.user_metadata["amount"] == refund_transaction.amount
        assert event.user_metadata["currency"] == refund_transaction.currency
        assert event.user_metadata["tax_amount"] == refund_transaction.tax_amount
        assert event.user_metadata["tax_country"] == ""
        assert event.user_metadata["tax_state"] == ""
        assert event.user_metadata["fee"] == 0

    async def test_skips_transactions_with_existing_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
        )
        payment = await create_payment(save_fixture, organization, order=order)
        refund = await create_refund(save_fixture, order=order, payment=payment)
        refund_transaction = await create_refund_transaction(
            save_fixture,
            refund=refund,
            order=order,
        )

        existing_event = Event(
            name=SystemEvent.balance_refund,
            source=EventSource.system,
            customer_id=customer.id,
            organization_id=organization.id,
            user_metadata={
                "transaction_id": str(refund_transaction.id),
                "refund_id": str(refund.id),
                "amount": refund_transaction.amount,
                "currency": refund_transaction.currency,
            },
        )
        await save_fixture(existing_event)

        created = await create_missing_balance_refund_events(
            session, batch_size=10, rate_limit_delay=0
        )

        assert created == 0

    async def test_multiple_partial_refunds_with_completing_refund(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subtotal_amount=3000,
            tax_amount=0,
            refunded_amount=3000,
            refunded_tax_amount=0,
        )
        payment = await create_payment(save_fixture, organization, order=order)

        refund1 = await create_refund(
            save_fixture,
            order=order,
            payment=payment,
            amount=1000,
            tax_amount=0,
            processor_id="STRIPE_REFUND_1",
        )
        refund_tx1 = await create_refund_transaction(
            save_fixture,
            refund=refund1,
            order=order,
            amount=-1000,
        )

        refund2 = await create_refund(
            save_fixture,
            order=order,
            payment=payment,
            amount=1000,
            tax_amount=0,
            processor_id="STRIPE_REFUND_2",
        )
        refund_tx2 = await create_refund_transaction(
            save_fixture,
            refund=refund2,
            order=order,
            amount=-1000,
        )

        refund3 = await create_refund(
            save_fixture,
            order=order,
            payment=payment,
            amount=1000,
            tax_amount=0,
            processor_id="STRIPE_REFUND_3",
        )
        refund_tx3 = await create_refund_transaction(
            save_fixture,
            refund=refund3,
            order=order,
            amount=-1000,
        )

        created = await create_missing_balance_refund_events(
            session, batch_size=10, rate_limit_delay=0
        )

        assert created == 3

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_name(SystemEvent.balance_refund)

        assert len(events) == 3

        events_by_refund = {e.user_metadata["refund_id"]: e for e in events}

        event1 = events_by_refund[str(refund1.id)]
        assert event1.user_metadata["refundable_amount"] == 3000 - 1000

        event2 = events_by_refund[str(refund2.id)]
        assert event2.user_metadata["refundable_amount"] == 3000 - 1000 - 1000

        event3 = events_by_refund[str(refund3.id)]
        assert event3.user_metadata["refundable_amount"] == 0


@pytest.mark.asyncio
class TestCreateMissingBalanceDisputeEvents:
    async def test_creates_events_for_dispute_transactions_without_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
        )
        payment = await create_payment(save_fixture, organization, order=order)
        dispute = await create_dispute(save_fixture, order=order, payment=payment)
        dispute_transaction = await create_dispute_transaction(
            save_fixture,
            dispute=dispute,
            order=order,
        )
        dispute_transaction.payment_customer = customer
        dispute_transaction.payment_organization = organization
        await save_fixture(dispute_transaction)

        created = await create_missing_balance_dispute_events(
            session, batch_size=10, rate_limit_delay=0
        )

        assert created == 1

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_name(SystemEvent.balance_dispute)

        assert len(events) == 1
        event = events[0]
        assert event.customer_id == customer.id
        assert event.organization_id == organization.id
        assert event.user_metadata["transaction_id"] == str(dispute_transaction.id)
        assert event.user_metadata["dispute_id"] == str(dispute.id)
        assert event.user_metadata["amount"] == dispute_transaction.amount
        assert event.user_metadata["currency"] == dispute_transaction.currency
        assert event.user_metadata["tax_amount"] == dispute_transaction.tax_amount
        assert event.user_metadata["tax_country"] == ""
        assert event.user_metadata["tax_state"] == ""
        assert event.user_metadata["fee"] == 0

    async def test_computes_dispute_fees_from_balance_transactions(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
        )
        payment = await create_payment(save_fixture, organization, order=order)
        dispute = await create_dispute(save_fixture, order=order, payment=payment)
        dispute_transaction = await create_dispute_transaction(
            save_fixture,
            dispute=dispute,
            order=order,
        )
        dispute_transaction.payment_customer = customer
        dispute_transaction.payment_organization = organization
        await save_fixture(dispute_transaction)

        dispute_fee_transaction = Transaction(
            type=TransactionType.balance,
            processor=None,
            currency="usd",
            amount=1500,
            account_currency="usd",
            account_amount=1500,
            tax_amount=0,
            account=None,
            order=order,
            platform_fee_type=PlatformFeeType.dispute,
        )
        await save_fixture(dispute_fee_transaction)

        created = await create_missing_balance_dispute_events(
            session, batch_size=10, rate_limit_delay=0
        )

        assert created == 1

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_name(SystemEvent.balance_dispute)

        assert len(events) == 1
        event = events[0]
        assert event.user_metadata["fee"] == 1500

    async def test_skips_transactions_with_existing_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
        )
        payment = await create_payment(save_fixture, organization, order=order)
        dispute = await create_dispute(save_fixture, order=order, payment=payment)
        dispute_transaction = await create_dispute_transaction(
            save_fixture,
            dispute=dispute,
            order=order,
        )
        dispute_transaction.payment_customer = customer
        dispute_transaction.payment_organization = organization
        await save_fixture(dispute_transaction)

        existing_event = Event(
            name=SystemEvent.balance_dispute,
            source=EventSource.system,
            customer_id=customer.id,
            organization_id=organization.id,
            user_metadata={
                "transaction_id": str(dispute_transaction.id),
                "dispute_id": str(dispute.id),
                "amount": dispute_transaction.amount,
                "currency": dispute_transaction.currency,
            },
        )
        await save_fixture(existing_event)

        created = await create_missing_balance_dispute_events(
            session, batch_size=10, rate_limit_delay=0
        )

        assert created == 0


@pytest.mark.asyncio
class TestCreateMissingBalanceDisputeReversalEvents:
    async def test_creates_events_for_dispute_reversal_transactions_without_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
        )
        payment = await create_payment(save_fixture, organization, order=order)
        dispute = await create_dispute(save_fixture, order=order, payment=payment)

        dispute_reversal_transaction = Transaction(
            type=TransactionType.dispute_reversal,
            processor=dispute.payment_processor,
            currency="usd",
            amount=1000,
            account_currency="usd",
            account_amount=1000,
            tax_amount=0,
            dispute=dispute,
            order=order,
            presentment_currency="usd",
            presentment_amount=1000,
        )
        dispute_reversal_transaction.payment_customer = customer
        dispute_reversal_transaction.payment_organization = organization
        await save_fixture(dispute_reversal_transaction)

        processor_fee = Transaction(
            type=TransactionType.processor_fee,
            processor=dispute.payment_processor,
            currency="usd",
            amount=-1500,
            account_currency="usd",
            account_amount=-1500,
            tax_amount=0,
            incurred_by_transaction=dispute_reversal_transaction,
        )
        await save_fixture(processor_fee)

        created = await create_missing_balance_dispute_reversal_events(
            session, batch_size=10, rate_limit_delay=0
        )

        assert created == 1

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_name(
            SystemEvent.balance_dispute_reversal
        )

        assert len(events) == 1
        event = events[0]
        assert event.customer_id == customer.id
        assert event.organization_id == organization.id
        assert event.user_metadata["transaction_id"] == str(
            dispute_reversal_transaction.id
        )
        assert event.user_metadata["dispute_id"] == str(dispute.id)
        assert event.user_metadata["amount"] == dispute_reversal_transaction.amount
        assert event.user_metadata["currency"] == dispute_reversal_transaction.currency
        assert (
            event.user_metadata["tax_amount"] == dispute_reversal_transaction.tax_amount
        )
        assert event.user_metadata["tax_country"] == ""
        assert event.user_metadata["tax_state"] == ""
        assert event.user_metadata["fee"] == 1500

    async def test_skips_transactions_with_existing_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
        )
        payment = await create_payment(save_fixture, organization, order=order)
        dispute = await create_dispute(save_fixture, order=order, payment=payment)

        dispute_reversal_transaction = Transaction(
            type=TransactionType.dispute_reversal,
            processor=dispute.payment_processor,
            currency="usd",
            amount=1000,
            account_currency="usd",
            account_amount=1000,
            tax_amount=0,
            dispute=dispute,
            order=order,
            presentment_currency="usd",
            presentment_amount=1000,
        )
        dispute_reversal_transaction.payment_customer = customer
        dispute_reversal_transaction.payment_organization = organization
        await save_fixture(dispute_reversal_transaction)

        existing_event = Event(
            name=SystemEvent.balance_dispute_reversal,
            source=EventSource.system,
            customer_id=customer.id,
            organization_id=organization.id,
            user_metadata={
                "transaction_id": str(dispute_reversal_transaction.id),
                "dispute_id": str(dispute.id),
                "amount": dispute_reversal_transaction.amount,
                "currency": dispute_reversal_transaction.currency,
            },
        )
        await save_fixture(existing_event)

        created = await create_missing_balance_dispute_reversal_events(
            session, batch_size=10, rate_limit_delay=0
        )

        assert created == 0


@pytest.mark.asyncio
class TestCreateMissingBalanceRefundReversalEvents:
    async def test_creates_events_for_refund_reversal_transactions_without_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
        )
        payment = await create_payment(save_fixture, organization, order=order)
        refund = await create_refund(save_fixture, order=order, payment=payment)

        refund_reversal_transaction = Transaction(
            type=TransactionType.refund_reversal,
            processor=refund.processor,
            currency="usd",
            amount=1000,
            account_currency="usd",
            account_amount=1000,
            tax_amount=0,
            refund=refund,
            order=order,
            presentment_currency="usd",
            presentment_amount=1000,
        )
        await save_fixture(refund_reversal_transaction)

        created = await create_missing_balance_refund_reversal_events(
            session, batch_size=10, rate_limit_delay=0
        )

        assert created == 1

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_name(
            SystemEvent.balance_refund_reversal
        )

        assert len(events) == 1
        event = events[0]
        assert event.customer_id == customer.id
        assert event.organization_id == organization.id
        assert event.user_metadata["transaction_id"] == str(
            refund_reversal_transaction.id
        )
        assert event.user_metadata["refund_id"] == str(refund.id)
        assert event.user_metadata["order_id"] == str(order.id)
        assert event.user_metadata["amount"] == refund_reversal_transaction.amount
        assert event.user_metadata["currency"] == refund_reversal_transaction.currency
        assert (
            event.user_metadata["tax_amount"] == refund_reversal_transaction.tax_amount
        )
        assert event.user_metadata["tax_country"] == ""
        assert event.user_metadata["tax_state"] == ""
        assert event.user_metadata["fee"] == 0

    async def test_skips_transactions_with_existing_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
        )
        payment = await create_payment(save_fixture, organization, order=order)
        refund = await create_refund(save_fixture, order=order, payment=payment)

        refund_reversal_transaction = Transaction(
            type=TransactionType.refund_reversal,
            processor=refund.processor,
            currency="usd",
            amount=1000,
            account_currency="usd",
            account_amount=1000,
            tax_amount=0,
            refund=refund,
            order=order,
            presentment_currency="usd",
            presentment_amount=1000,
        )
        await save_fixture(refund_reversal_transaction)

        existing_event = Event(
            name=SystemEvent.balance_refund_reversal,
            source=EventSource.system,
            customer_id=customer.id,
            organization_id=organization.id,
            user_metadata={
                "transaction_id": str(refund_reversal_transaction.id),
                "refund_id": str(refund.id),
                "amount": refund_reversal_transaction.amount,
                "currency": refund_reversal_transaction.currency,
            },
        )
        await save_fixture(existing_event)

        created = await create_missing_balance_refund_reversal_events(
            session, batch_size=10, rate_limit_delay=0
        )

        assert created == 0
