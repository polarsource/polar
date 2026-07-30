from typing import cast
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.enums import PaymentProcessor, SubscriptionRecurringInterval
from polar.integrations.stripe.service import StripeService
from polar.models import Customer, Organization, PaymentMethod, Product
from polar.models.organization import OrganizationCustomerEmailSettings
from polar.models.subscription import SubscriptionStatus
from polar.payment_method.service import (
    PaymentMethodInUseByActiveSubscription,
)
from polar.payment_method.service import (
    payment_method as payment_method_service,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_payment_method,
    create_product,
    create_subscription,
)
from tests.fixtures.stripe import build_stripe_payment_method


@pytest.mark.asyncio
class TestUpsertFromStripe:
    async def test_create_new_payment_method(
        self,
        session: AsyncSession,
        customer: Customer,
    ) -> None:
        # Build a stripe payment method
        stripe_payment_method = build_stripe_payment_method(
            type="card",
            details={"brand": "visa", "last4": "4242"},
        )

        # Test upsert_from_stripe
        payment_method = await payment_method_service.upsert_from_stripe(
            session, customer, stripe_payment_method
        )

        # Verify payment method was created correctly
        assert payment_method.processor == PaymentProcessor.stripe
        assert payment_method.processor_id == stripe_payment_method.id
        assert payment_method.type == "card"
        assert payment_method.method_metadata == {"brand": "visa", "last4": "4242"}
        assert payment_method.customer == customer

    async def test_update_existing_payment_method(
        self,
        session: AsyncSession,
        customer: Customer,
    ) -> None:
        # First create a payment method
        stripe_payment_method = build_stripe_payment_method(
            type="card",
            details={"brand": "visa", "last4": "4242"},
        )
        payment_method = await payment_method_service.upsert_from_stripe(
            session, customer, stripe_payment_method
        )

        # Now update it with new details
        updated_stripe_payment_method = build_stripe_payment_method(
            type="card",
            details={"brand": "mastercard", "last4": "9999"},
        )
        updated_payment_method = await payment_method_service.upsert_from_stripe(
            session, customer, updated_stripe_payment_method
        )

        # Verify it's the same payment method but with updated details
        assert updated_payment_method.id == payment_method.id
        assert updated_payment_method.processor == PaymentProcessor.stripe
        assert updated_payment_method.processor_id == updated_stripe_payment_method.id
        assert updated_payment_method.type == "card"
        assert updated_payment_method.method_metadata == {
            "brand": "mastercard",
            "last4": "9999",
        }
        assert updated_payment_method.customer == customer


@pytest.mark.asyncio
class TestDelete:
    @pytest.fixture(autouse=True)
    def stripe_service_mock(self, mocker: MockerFixture) -> MagicMock:
        mock = MagicMock(spec=StripeService)
        mocker.patch("polar.payment_method.service.stripe_service", new=mock)
        return mock

    async def test_delete_payment_method_with_no_subscriptions(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
    ) -> None:
        payment_method = PaymentMethod(
            processor=PaymentProcessor.stripe,
            processor_id="pm_test_123",
            type="card",
            method_metadata={"brand": "visa", "last4": "4242"},
            customer=customer,
        )
        await save_fixture(payment_method)

        await payment_method_service.delete(session, payment_method)

        await session.flush()
        await session.refresh(payment_method)
        assert payment_method.deleted_at is not None

    @pytest.mark.parametrize(
        "status",
        [
            SubscriptionStatus.trialing,
            SubscriptionStatus.active,
            SubscriptionStatus.past_due,
        ],
    )
    async def test_delete_payment_method_with_billable_subscription_raises_exception(
        self,
        status: SubscriptionStatus,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        payment_method = PaymentMethod(
            processor=PaymentProcessor.stripe,
            processor_id="pm_test_456",
            type="card",
            method_metadata={"brand": "visa", "last4": "4242"},
            customer=customer,
        )
        await save_fixture(payment_method)

        subscription = await create_subscription(
            save_fixture,
            status=status,
            product=product,
            customer=customer,
        )
        subscription.payment_method = payment_method
        await save_fixture(subscription)

        with pytest.raises(PaymentMethodInUseByActiveSubscription) as exc_info:
            await payment_method_service.delete(session, payment_method)

        assert subscription.id in exc_info.value.subscription_ids
        assert "Cannot delete payment method" in str(exc_info.value)

        await session.refresh(payment_method)
        assert payment_method.deleted_at is None

    async def test_delete_payment_method_with_canceled_subscription_succeeds(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        payment_method = PaymentMethod(
            processor=PaymentProcessor.stripe,
            processor_id="pm_test_789",
            type="card",
            method_metadata={"brand": "visa", "last4": "4242"},
            customer=customer,
        )
        await save_fixture(payment_method)

        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.canceled,
        )
        subscription.payment_method = payment_method
        await save_fixture(subscription)

        await payment_method_service.delete(session, payment_method)

        await session.flush()
        await session.refresh(payment_method)
        assert payment_method.deleted_at is not None

    async def test_delete_payment_method_with_active_subscription_and_alternative_succeeds(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        payment_method_1 = PaymentMethod(
            processor=PaymentProcessor.stripe,
            processor_id="pm_test_primary",
            type="card",
            method_metadata={"brand": "visa", "last4": "4242"},
            customer=customer,
        )
        await save_fixture(payment_method_1)

        payment_method_2 = PaymentMethod(
            processor=PaymentProcessor.stripe,
            processor_id="pm_test_alternative",
            type="card",
            method_metadata={"brand": "mastercard", "last4": "9999"},
            customer=customer,
        )
        await save_fixture(payment_method_2)

        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        subscription.payment_method = payment_method_1
        await save_fixture(subscription)

        await payment_method_service.delete(session, payment_method_1)

        # Payment method should be soft deleted
        await session.flush()
        await session.refresh(payment_method_1)
        assert payment_method_1.deleted_at is not None

        # Subscription should be reassigned to the alternative payment method
        await session.refresh(subscription)
        assert subscription.payment_method_id == payment_method_2.id

    async def test_delete_payment_method_prefers_default_payment_method(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        payment_method_1 = PaymentMethod(
            processor=PaymentProcessor.stripe,
            processor_id="pm_test_primary",
            type="card",
            method_metadata={"brand": "visa", "last4": "4242"},
            customer=customer,
        )
        await save_fixture(payment_method_1)

        payment_method_2 = PaymentMethod(
            processor=PaymentProcessor.stripe,
            processor_id="pm_test_alternative1",
            type="card",
            method_metadata={"brand": "mastercard", "last4": "9999"},
            customer=customer,
        )
        await save_fixture(payment_method_2)

        payment_method_default = PaymentMethod(
            processor=PaymentProcessor.stripe,
            processor_id="pm_test_default",
            type="card",
            method_metadata={"brand": "amex", "last4": "1234"},
            customer=customer,
        )
        await save_fixture(payment_method_default)

        customer.default_payment_method = payment_method_default
        await save_fixture(customer)

        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        subscription.payment_method = payment_method_1
        await save_fixture(subscription)

        await payment_method_service.delete(session, payment_method_1)

        await session.flush()
        await session.refresh(payment_method_1)
        assert payment_method_1.deleted_at is not None

        # Subscription should be reassigned to the default payment method
        await session.refresh(subscription)
        assert subscription.payment_method_id == payment_method_default.id


@pytest.fixture
def enqueue_email_template_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch(
        "polar.payment_method.service.enqueue_email_template", autospec=True
    )


async def create_expiring_card(
    save_fixture: SaveFixture, customer: Customer
) -> PaymentMethod:
    return await create_payment_method(
        save_fixture,
        customer,
        method_metadata={
            "brand": "visa",
            "last4": "4242",
            "exp_month": 4,
            "exp_year": 2026,
        },
    )


@pytest.mark.asyncio
class TestSendExpiringReminderEmail:
    async def test_enqueues_email_naming_the_product(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        enqueue_email_template_mock: MagicMock,
    ) -> None:
        payment_method = await create_expiring_card(save_fixture, customer)
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            payment_method=payment_method,
        )

        await payment_method_service.send_expiration_reminder_email(
            session, payment_method
        )

        enqueue_email_template_mock.assert_called_once()
        email = enqueue_email_template_mock.call_args.args[0]
        assert email.template == "payment_method_expiration_reminder"
        assert email.props.product_names == [product.name]
        assert email.props.expiration_date == "April 2026"
        assert email.props.payment_method.method_metadata.last4 == "4242"
        assert (
            enqueue_email_template_mock.call_args.kwargs["subject"]
            == "Your card ending in 4242 expires soon"
        )

    async def test_passes_deduplication_key(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        enqueue_email_template_mock: MagicMock,
    ) -> None:
        payment_method = await create_expiring_card(save_fixture, customer)
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            payment_method=payment_method,
        )

        await payment_method_service.send_expiration_reminder_email(
            session, payment_method
        )

        assert (
            enqueue_email_template_mock.call_args.kwargs["deduplication_key"]
            == f"payment_method_expiration_reminder:{payment_method.id}:2026-4"
        )

    async def test_names_every_billable_product_once(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
        enqueue_email_template_mock: MagicMock,
    ) -> None:
        other_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            name="Another Product",
        )
        payment_method = await create_expiring_card(save_fixture, customer)
        for subscribed_product in (product, other_product, product):
            await create_active_subscription(
                save_fixture,
                product=subscribed_product,
                customer=customer,
                payment_method=payment_method,
            )

        await payment_method_service.send_expiration_reminder_email(
            session, payment_method
        )

        email = enqueue_email_template_mock.call_args.args[0]
        assert email.props.product_names == sorted({product.name, "Another Product"})

    async def test_ignores_products_of_non_billable_subscriptions(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
        enqueue_email_template_mock: MagicMock,
    ) -> None:
        canceled_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            name="Canceled Product",
        )
        payment_method = await create_expiring_card(save_fixture, customer)
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            payment_method=payment_method,
        )
        await create_subscription(
            save_fixture,
            product=canceled_product,
            customer=customer,
            payment_method=payment_method,
            status=SubscriptionStatus.canceled,
        )

        await payment_method_service.send_expiration_reminder_email(
            session, payment_method
        )

        email = enqueue_email_template_mock.call_args.args[0]
        assert email.props.product_names == [product.name]

    async def test_skips_when_no_billable_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        enqueue_email_template_mock: MagicMock,
    ) -> None:
        payment_method = await create_expiring_card(save_fixture, customer)

        await payment_method_service.send_expiration_reminder_email(
            session, payment_method
        )

        enqueue_email_template_mock.assert_not_called()

    async def test_skips_non_card_payment_method(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        enqueue_email_template_mock: MagicMock,
    ) -> None:
        payment_method = await create_payment_method(
            save_fixture, customer, type="link", method_metadata={}
        )

        await payment_method_service.send_expiration_reminder_email(
            session, payment_method
        )

        enqueue_email_template_mock.assert_not_called()

    async def test_skips_when_organization_disabled_the_cycle_email(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        product: Product,
        enqueue_email_template_mock: MagicMock,
    ) -> None:
        """An organization predating this template has no stored key, so the
        setting is inherited from their subscription cycle preference."""
        stored = {
            key: value
            for key, value in organization.customer_email_settings.items()
            if key != "payment_method_expiration_reminder"
        } | {"subscription_cycled": False}
        organization.customer_email_settings = cast(
            OrganizationCustomerEmailSettings, stored
        )
        await save_fixture(organization)

        payment_method = await create_expiring_card(save_fixture, customer)
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            payment_method=payment_method,
        )

        await payment_method_service.send_expiration_reminder_email(
            session, payment_method
        )

        enqueue_email_template_mock.assert_not_called()

    async def test_skips_when_organization_disabled_the_email(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        product: Product,
        enqueue_email_template_mock: MagicMock,
    ) -> None:
        organization.customer_email_settings = {
            **organization.customer_email_settings,
            "payment_method_expiration_reminder": False,
        }
        await save_fixture(organization)

        payment_method = await create_expiring_card(save_fixture, customer)
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            payment_method=payment_method,
        )

        await payment_method_service.send_expiration_reminder_email(
            session, payment_method
        )

        enqueue_email_template_mock.assert_not_called()
