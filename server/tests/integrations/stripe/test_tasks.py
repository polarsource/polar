import uuid
from unittest.mock import AsyncMock

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture
from sqlalchemy.orm import selectinload

from polar.customer.repository import CustomerRepository
from polar.enums import PaymentProcessor, SubscriptionRecurringInterval
from polar.integrations.stripe.tasks import (
    account_risk_signal,
    payment_intent_succeeded,
    payment_method_automatically_updated,
    payment_method_detached,
)
from polar.models import (
    Customer,
    Organization,
    PaymentMethod,
    User,
)
from polar.models.organization import OrganizationStatus
from polar.organization.repository import OrganizationRepository
from polar.payment_method.repository import PaymentMethodRepository
from polar.postgres import AsyncSession
from polar.subscription.repository import SubscriptionRepository
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_order,
    create_payment_method,
    create_payout_account,
    create_product,
)

WEBSITE_EVENT_TYPE = "v2.core.account_signals.fraudulent_website_ready"


def build_stripe_payment_intent(
    *,
    payment_method_id: str = "pm_test",
    customer_id: str = "cus_test",
    order_id: str | None = None,
    amount: int = 1000,
    status: str = "succeeded",
) -> stripe_lib.PaymentIntent:
    metadata = {}
    if order_id:
        metadata["order_id"] = order_id

    return stripe_lib.PaymentIntent.construct_from(
        {
            "id": "pi_test",
            "object": "payment_intent",
            "amount": amount,
            "amount_received": amount,
            "currency": "usd",
            "status": status,
            "payment_method": payment_method_id,
            "customer": customer_id,
            "metadata": metadata,
            "invoice": None,
            "latest_charge": "ch_test",
            "receipt_email": None,
        },
        stripe_lib.api_key,
    )


@pytest.mark.asyncio
class TestAccountRiskSignal:
    def _mock_thin_event(self, mocker: MockerFixture) -> None:
        event_mock = mocker.MagicMock()
        event_mock.data = {"id": "evt_test", "type": WEBSITE_EVENT_TYPE}
        context_mock = mocker.patch(
            "polar.integrations.stripe.tasks.external_event_service.handle_stripe"
        )
        context_mock.return_value.__aenter__ = AsyncMock(return_value=event_mock)
        context_mock.return_value.__aexit__ = AsyncMock(return_value=None)

    async def test_actionable_signal_puts_org_under_review(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        organization.status = OrganizationStatus.ACTIVE
        await save_fixture(organization)
        payout_account = await create_payout_account(
            save_fixture, organization, user, stripe_id="acct_risk_test"
        )

        self._mock_thin_event(mocker)
        mocker.patch(
            "polar.integrations.stripe.tasks.stripe_service.get_account_risk_event",
            new=AsyncMock(
                return_value={
                    "type": WEBSITE_EVENT_TYPE,
                    "data": {
                        "account": payout_account.stripe_id,
                        "risk_level": "elevated",
                        "details": "Deceptive website",
                    },
                }
            ),
        )

        await account_risk_signal(uuid.uuid4())

        organization_repository = OrganizationRepository.from_session(session)
        updated = await organization_repository.get_by_id(organization.id)
        assert updated is not None
        assert updated.status == OrganizationStatus.REVIEW

    async def test_unparseable_event_is_a_noop(
        self,
        mocker: MockerFixture,
    ) -> None:
        self._mock_thin_event(mocker)
        mocker.patch(
            "polar.integrations.stripe.tasks.stripe_service.get_account_risk_event",
            new=AsyncMock(return_value={"type": "charge.succeeded", "data": {}}),
        )
        handle_mock = mocker.patch(
            "polar.integrations.stripe.tasks.organization_service"
            ".handle_account_risk_signal"
        )

        await account_risk_signal(uuid.uuid4())

        handle_mock.assert_not_called()


@pytest.mark.asyncio
class TestPaymentIntentSucceeded:
    async def test_retry_payment_saves_payment_method_and_updates_subscription(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Given: Subscription with existing payment method
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )

        old_payment_method = PaymentMethod(
            processor=PaymentProcessor.stripe,
            processor_id="pm_old",
            type="card",
            customer=customer,
        )
        await save_fixture(old_payment_method)

        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        subscription.payment_method = old_payment_method
        await save_fixture(subscription)

        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
        )

        payment_intent = build_stripe_payment_intent(
            payment_method_id="pm_new",
            customer_id=customer.stripe_customer_id,  # type: ignore
            order_id=str(order.id),
        )

        event_mock = mocker.MagicMock()
        event_mock.stripe_data.data.object = payment_intent

        context_mock = mocker.patch(
            "polar.integrations.stripe.tasks.external_event_service.handle_stripe"
        )
        context_mock.return_value.__aenter__ = AsyncMock(return_value=event_mock)
        context_mock.return_value.__aexit__ = AsyncMock(return_value=None)

        # Mock Stripe API calls
        mocker.patch(
            "polar.integrations.stripe.tasks.payment.resolve_order", return_value=order
        )

        stripe_payment_method = stripe_lib.PaymentMethod.construct_from(
            {
                "id": "pm_new",
                "object": "payment_method",
                "type": "card",
                "customer": customer.stripe_customer_id,
                "card": {
                    "brand": "visa",
                    "last4": "4242",
                    "exp_month": 12,
                    "exp_year": 2025,
                },
            },
            stripe_lib.api_key,
        )
        mocker.patch(
            "polar.integrations.stripe.service.stripe.get_payment_method",
            return_value=stripe_payment_method,
        )

        # When: Process webhook
        event_id = uuid.uuid4()
        await payment_intent_succeeded(event_id)

        # Then: Subscription payment method is updated in database
        subscription_repo = SubscriptionRepository.from_session(session)
        updated_subscription = await subscription_repo.get_by_id(
            subscription.id,
            options=(selectinload(subscription_repo.model.payment_method),),
        )
        assert updated_subscription is not None
        assert updated_subscription.payment_method is not None
        assert updated_subscription.payment_method.processor_id == "pm_new"

    async def test_retry_payment_one_time_product_does_not_save_payment_method(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Given: One-time product (no subscription)
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
        )

        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=None,
        )

        # Mock external services
        payment_intent = build_stripe_payment_intent(
            payment_method_id="pm_new",
            customer_id=customer.stripe_customer_id,  # type: ignore
            order_id=str(order.id),
        )

        event_mock = mocker.MagicMock()
        event_mock.stripe_data.data.object = payment_intent

        context_mock = mocker.patch(
            "polar.integrations.stripe.tasks.external_event_service.handle_stripe"
        )
        context_mock.return_value.__aenter__ = AsyncMock(return_value=event_mock)
        context_mock.return_value.__aexit__ = AsyncMock(return_value=None)

        mocker.patch(
            "polar.integrations.stripe.tasks.payment.resolve_order", return_value=order
        )

        subscription_service_mock = mocker.patch(
            "polar.integrations.stripe.tasks.subscription_service.update_payment_method_from_retry"
        )

        # When: Process webhook
        event_id = uuid.uuid4()
        await payment_intent_succeeded(event_id)

        # Then: Subscription service is not called (no recurring product)
        subscription_service_mock.assert_not_called()

    async def test_payment_intent_without_order_metadata_ignored(
        self,
        mocker: MockerFixture,
    ) -> None:
        # Given: PaymentIntent without order metadata (not a retry payment)
        payment_intent = build_stripe_payment_intent()

        event_mock = mocker.MagicMock()
        event_mock.stripe_data.data.object = payment_intent

        context_mock = mocker.patch(
            "polar.integrations.stripe.tasks.external_event_service.handle_stripe"
        )
        context_mock.return_value.__aenter__ = AsyncMock(return_value=event_mock)
        context_mock.return_value.__aexit__ = AsyncMock(return_value=None)

        payment_method_service_mock = mocker.patch(
            "polar.integrations.stripe.tasks.payment_method_service.upsert_from_stripe_payment_intent_for_order"
        )

        # When: Process webhook
        event_id = uuid.uuid4()
        await payment_intent_succeeded(event_id)

        # Then: Payment method service is not called (no retry metadata)
        payment_method_service_mock.assert_not_called()


def build_stripe_card_payment_method(
    *,
    payment_method_id: str = "pm_test",
    customer_id: str | None = None,
    brand: str = "visa",
    last4: str = "4242",
    exp_month: int = 12,
    exp_year: int = 2030,
) -> stripe_lib.PaymentMethod:
    return stripe_lib.PaymentMethod.construct_from(
        {
            "id": payment_method_id,
            "object": "payment_method",
            "type": "card",
            "customer": customer_id,
            "card": {
                "brand": brand,
                "last4": last4,
                "exp_month": exp_month,
                "exp_year": exp_year,
            },
        },
        stripe_lib.api_key,
    )


def patch_stripe_event(
    mocker: MockerFixture, stripe_object: stripe_lib.StripeObject
) -> None:
    event_mock = mocker.MagicMock()
    event_mock.stripe_data.data.object = stripe_object

    context_mock = mocker.patch(
        "polar.integrations.stripe.tasks.external_event_service.handle_stripe"
    )
    context_mock.return_value.__aenter__ = AsyncMock(return_value=event_mock)
    context_mock.return_value.__aexit__ = AsyncMock(return_value=None)


@pytest.mark.asyncio
class TestPaymentMethodDetached:
    async def test_soft_deletes_matching_payment_method(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
    ) -> None:
        # Given: Customer with a stored payment method set as default
        payment_method = await create_payment_method(
            save_fixture,
            customer,
            processor_id="pm_detach_test",
            method_metadata={"brand": "visa", "last4": "4242"},
        )
        customer.default_payment_method = payment_method
        await save_fixture(customer)

        patch_stripe_event(
            mocker,
            build_stripe_card_payment_method(payment_method_id="pm_detach_test"),
        )
        # Stripe already detached on their side; our delete_payment_method call
        # would fail — swallow it.
        mocker.patch(
            "polar.payment_method.service.stripe_service.delete_payment_method",
            side_effect=stripe_lib.InvalidRequestError("already detached", param=None),
        )

        # When: Process webhook
        await payment_method_detached(uuid.uuid4())

        # Then: Payment method is soft-deleted and unlinked from the customer
        pm_repo = PaymentMethodRepository.from_session(session)
        stored = await pm_repo.get_by_processor_id(
            PaymentProcessor.stripe, "pm_detach_test"
        )
        assert stored is None

        customer_repo = CustomerRepository.from_session(session)
        refreshed_customer = await customer_repo.get_by_id(customer.id)
        assert refreshed_customer is not None
        assert refreshed_customer.default_payment_method_id is None

    async def test_unknown_payment_method_is_noop(
        self,
        mocker: MockerFixture,
    ) -> None:
        # Given: Webhook for a payment method we don't have on file
        patch_stripe_event(
            mocker,
            build_stripe_card_payment_method(payment_method_id="pm_unknown"),
        )
        delete_mock = mocker.patch(
            "polar.integrations.stripe.tasks.payment_method_service.delete"
        )

        # When: Process webhook
        await payment_method_detached(uuid.uuid4())

        # Then: The service is not invoked
        delete_mock.assert_not_called()


@pytest.mark.asyncio
class TestPaymentMethodAutomaticallyUpdated:
    async def test_updates_matching_payment_method(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
    ) -> None:
        await create_payment_method(
            save_fixture,
            customer,
            processor_id="pm_update_test",
            method_metadata={
                "brand": "visa",
                "last4": "4242",
                "exp_month": 12,
                "exp_year": 2026,
            },
        )

        patch_stripe_event(
            mocker,
            build_stripe_card_payment_method(
                payment_method_id="pm_update_test",
                customer_id="cus_test",
                brand="mastercard",
                last4="9999",
                exp_month=6,
                exp_year=2032,
            ),
        )

        await payment_method_automatically_updated(uuid.uuid4())

        repository = PaymentMethodRepository.from_session(session)
        payment_method = await repository.get_by_processor_id(
            PaymentProcessor.stripe, "pm_update_test"
        )
        assert payment_method is not None
        assert payment_method.method_metadata == {
            "brand": "mastercard",
            "last4": "9999",
            "exp_month": 6,
            "exp_year": 2032,
        }

    async def test_unknown_payment_method_is_noop(
        self,
        mocker: MockerFixture,
    ) -> None:
        patch_stripe_event(
            mocker,
            build_stripe_card_payment_method(payment_method_id="pm_unknown"),
        )
        upsert_mock = mocker.patch(
            "polar.integrations.stripe.tasks.payment_method_service.upsert_from_stripe"
        )

        await payment_method_automatically_updated(uuid.uuid4())

        upsert_mock.assert_not_called()
