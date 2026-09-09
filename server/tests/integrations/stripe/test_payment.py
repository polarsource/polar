import asyncio
from datetime import timedelta

import pytest
import stripe as stripe_lib
from freezegun import freeze_time
from sqlalchemy import delete

from polar.checkout.repository import CheckoutRepository
from polar.enums import PaymentProcessor
from polar.integrations.stripe.payment import (
    _resolve_trigger,
    handle_failure,
)
from polar.kit.db.postgres import (
    AsyncSession,
    create_async_engine,
    create_async_sessionmaker,
)
from polar.kit.utils import utc_now
from polar.models import (
    Account,
    Checkout,
    Customer,
    Organization,
    Product,
    Subscription,
    User,
)
from polar.models.checkout import CheckoutStatus
from polar.models.order import OrderStatus
from polar.models.payment import PaymentTrigger
from polar.models.subscription import SubscriptionStatus
from polar.order.repository import OrderRepository
from polar.payment.repository import PaymentRepository
from polar.subscription.repository import SubscriptionRepository
from tests.fixtures.database import SaveFixture, get_database_url, save_fixture_factory
from tests.fixtures.random_objects import (
    create_account,
    create_checkout,
    create_order,
    create_organization,
    create_product,
    create_user,
)
from tests.fixtures.stripe import build_stripe_charge, build_stripe_payment_intent


@pytest.mark.asyncio
class TestHandleFailure:
    """Integration tests for the failed payment. If it's an order, the subscription
    will be marked as past due, benefits will be revoked, and the order will have its next
    payment attempt scheduled."""

    @pytest.mark.parametrize("current_intent_id", ["pi_failed", "pi_new"])
    async def test_failure_waits_for_confirmation(
        self, worker_id: str, current_intent_id: str
    ) -> None:
        engine = create_async_engine(
            dsn=get_database_url(worker_id), pool_size=2, pool_recycle=3600
        )
        sessionmaker = create_async_sessionmaker(engine)
        async with sessionmaker() as setup:
            save = save_fixture_factory(setup)
            user = await create_user(save)
            account = await create_account(save, user)
            organization = await create_organization(save, account)
            product = await create_product(
                save, organization=organization, recurring_interval=None
            )
            checkout = await create_checkout(save, products=[product])
            await setup.commit()

        charge = build_stripe_charge(
            status="failed",
            payment_intent="pi_failed",
            metadata={
                "organization_id": str(organization.id),
                "checkout_id": str(checkout.id),
            },
            billing_details={"email": "test@example.com"},
            payment_method_details={"type": "card", "card": {"last4": "4242"}},
        )
        try:
            async with sessionmaker() as confirmation, sessionmaker() as failure:
                locked_checkout = await CheckoutRepository.from_session(
                    confirmation
                ).get_by_client_secret(checkout.client_secret, for_update=True)
                assert locked_checkout is not None
                locked_checkout.status = CheckoutStatus.confirmed
                locked_checkout.payment_processor_metadata = {
                    "intent_id": current_intent_id,
                    "intent_status": "requires_action",
                }
                await confirmation.flush()

                async with asyncio.TaskGroup() as tasks:
                    failure_task = tasks.create_task(handle_failure(failure, charge))
                    done, _ = await asyncio.wait({failure_task}, timeout=0.1)
                    assert not done
                    await confirmation.commit()

                updated_checkout = await CheckoutRepository.from_session(
                    failure
                ).get_by_id(checkout.id)
                assert updated_checkout is not None
                assert updated_checkout.status == (
                    CheckoutStatus.open
                    if current_intent_id == "pi_failed"
                    else CheckoutStatus.confirmed
                )
                assert (
                    updated_checkout.payment_processor_metadata["intent_id"]
                    == current_intent_id
                )
        finally:
            async with sessionmaker() as cleanup:
                await cleanup.execute(
                    delete(Checkout).where(Checkout.id == checkout.id)
                )
                await cleanup.execute(delete(Product).where(Product.id == product.id))
                await cleanup.execute(
                    delete(Organization).where(Organization.id == organization.id)
                )
                await cleanup.execute(delete(Account).where(Account.id == account.id))
                await cleanup.execute(delete(User).where(User.id == user.id))
                await cleanup.commit()
            await engine.dispose()

    @pytest.mark.parametrize(
        "current_intent_id", [None, "intent_current", "intent_stale"]
    )
    @pytest.mark.parametrize(
        "failure",
        [
            build_stripe_charge(
                status="failed",
                payment_intent="intent_current",
                billing_details={"email": "test@example.com"},
                payment_method_details={"type": "card", "card": {"last4": "4242"}},
            ),
            build_stripe_payment_intent(
                id="intent_current",
                last_payment_error={
                    "message": "Authentication failed",
                    "payment_method": {"type": "card", "card": {"last4": "4242"}},
                },
            ),
            stripe_lib.SetupIntent.construct_from({"id": "intent_current"}, None),
        ],
        ids=["charge", "payment_intent", "setup_intent"],
    )
    async def test_checkout_failure_matches_current_intent(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        failure: stripe_lib.Charge | stripe_lib.PaymentIntent | stripe_lib.SetupIntent,
        current_intent_id: str | None,
    ) -> None:
        metadata = {"intent_status": "requires_action"}
        if current_intent_id is not None:
            metadata["intent_id"] = current_intent_id
        checkout = await create_checkout(
            save_fixture,
            products=[product],
            status=CheckoutStatus.confirmed,
            payment_processor_metadata=metadata,
        )
        failure.metadata = {
            "organization_id": str(product.organization_id),
            "checkout_id": str(checkout.id),
        }

        await handle_failure(session, failure)

        if current_intent_id == "intent_stale":
            assert checkout.status == CheckoutStatus.confirmed
            assert checkout.payment_processor_metadata == metadata
        else:
            assert checkout.status == CheckoutStatus.open
            assert "intent_status" not in checkout.payment_processor_metadata

    @freeze_time("2024-01-01 12:00:00")
    async def test_full_dunning_flow_with_repositories(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        product: Product,
    ) -> None:
        """Test the complete dunning flow with actual repository calls"""
        # Given
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )

        order.next_payment_attempt_at = None
        assert order.subscription is not None
        await save_fixture(order)

        # Create stripe charge with order_id metadata
        stripe_charge = build_stripe_charge(
            status="failed",
            amount=2000,
            metadata={"order_id": str(order.id)},
            billing_details={"email": "test@example.com"},
            payment_method_details={
                "card": {"brand": "visa", "last4": "4242"},
                "type": "card",
            },
        )

        # When
        await handle_failure(session, stripe_charge)

        # Then
        order_repo = OrderRepository.from_session(session)
        subscription_repo = SubscriptionRepository.from_session(session)

        updated_order = await order_repo.get_by_id(order.id)
        assert updated_order is not None
        assert updated_order.next_payment_attempt_at is not None
        expected_retry_date = utc_now() + timedelta(days=2)
        assert updated_order.next_payment_attempt_at == expected_retry_date

        updated_subscription = await subscription_repo.get_by_id(subscription.id)
        assert updated_subscription is not None
        assert updated_subscription.status == SubscriptionStatus.past_due


class TestResolveTrigger:
    """Test the _resolve_trigger helper that extracts PaymentTrigger from Stripe metadata."""

    def test_explicit_payment_trigger_in_metadata(self) -> None:
        charge = build_stripe_charge(
            metadata={"payment_trigger": "retry_dunning"},
        )
        assert _resolve_trigger(charge) == PaymentTrigger.retry_dunning

    def test_all_trigger_values(self) -> None:
        for trigger in PaymentTrigger:
            charge = build_stripe_charge(metadata={"payment_trigger": trigger.value})
            assert _resolve_trigger(charge) == trigger

    def test_fallback_to_purchase_when_checkout_id_present(self) -> None:
        charge = build_stripe_charge(
            metadata={"checkout_id": "co_123"},
        )
        assert _resolve_trigger(charge) == PaymentTrigger.purchase

    def test_no_trigger_without_metadata_keys(self) -> None:
        """Backward compat: Stripe notifications from before the deployment
        won't have payment_trigger in metadata."""
        charge = build_stripe_charge(
            metadata={"order_id": "ord_123"},
        )
        assert _resolve_trigger(charge) is None

    def test_invalid_trigger_value_ignored(self) -> None:
        """If metadata contains a value we don't recognize, fall back gracefully."""
        charge = build_stripe_charge(
            metadata={"payment_trigger": "unknown_value"},
        )
        assert _resolve_trigger(charge) is None

    def test_explicit_trigger_takes_precedence_over_checkout(self) -> None:
        charge = build_stripe_charge(
            metadata={
                "payment_trigger": "retry_customer",
                "checkout_id": "co_123",
            },
        )
        assert _resolve_trigger(charge) == PaymentTrigger.retry_customer

    def test_payment_intent_with_trigger(self) -> None:
        pi = build_stripe_payment_intent(
            metadata={"payment_trigger": "retry_payment_method_update"},
            latest_charge=None,
            last_payment_error={
                "code": "card_declined",
                "message": "declined",
                "payment_method": {
                    "id": "pm_1",
                    "type": "card",
                    "card": {"brand": "visa", "last4": "4242"},
                },
            },
        )
        assert _resolve_trigger(pi) == PaymentTrigger.retry_payment_method_update

    def test_payment_intent_without_trigger(self) -> None:
        """Pre-deployment payment intents won't have payment_trigger."""
        pi = build_stripe_payment_intent(
            metadata={"order_id": "ord_123"},
            latest_charge=None,
            last_payment_error={
                "code": "card_declined",
                "message": "declined",
                "payment_method": {
                    "id": "pm_1",
                    "type": "card",
                    "card": {"brand": "visa", "last4": "4242"},
                },
            },
        )
        assert _resolve_trigger(pi) is None


@pytest.mark.asyncio
class TestHandleFailureTrigger:
    """Test that handle_failure persists the resolved trigger on the payment."""

    async def test_trigger_persisted_on_charge_with_explicit_trigger(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        product: Product,
    ) -> None:
        """A retry charge with explicit payment_trigger metadata should persist it."""
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )

        charge = build_stripe_charge(
            status="failed",
            amount=2000,
            metadata={
                "order_id": str(order.id),
                "payment_trigger": "retry_dunning",
            },
            billing_details={"email": "test@example.com"},
            payment_method_details={
                "card": {"brand": "visa", "last4": "4242"},
                "type": "card",
            },
        )

        await handle_failure(session, charge)

        payment_repo = PaymentRepository.from_session(session)
        payment = await payment_repo.get_by_processor_id(
            PaymentProcessor.stripe, charge.id
        )
        assert payment is not None
        assert payment.trigger == PaymentTrigger.retry_dunning

    async def test_no_trigger_for_pre_deployment_charge(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        product: Product,
    ) -> None:
        """Charges from before the deployment won't have payment_trigger metadata.
        The trigger should be None."""
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )

        charge = build_stripe_charge(
            status="failed",
            amount=2000,
            metadata={"order_id": str(order.id)},
            billing_details={"email": "test@example.com"},
            payment_method_details={
                "card": {"brand": "visa", "last4": "4242"},
                "type": "card",
            },
        )

        await handle_failure(session, charge)

        payment_repo = PaymentRepository.from_session(session)
        payment = await payment_repo.get_by_processor_id(
            PaymentProcessor.stripe, charge.id
        )
        assert payment is not None
        assert payment.trigger is None
