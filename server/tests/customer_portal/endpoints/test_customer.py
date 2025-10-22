from unittest.mock import MagicMock

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.integrations.stripe.service import StripeService
from polar.models import Customer, Product
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from tests.fixtures.auth import CUSTOMER_AUTH_SUBJECT
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_payment_method,
    create_subscription,
)


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.payment_method.service.stripe_service", new=mock)
    return mock


@pytest.mark.asyncio
class TestDeletePaymentMethod:
    async def test_anonymous(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
    ) -> None:
        payment_method = await create_payment_method(save_fixture, customer)
        response = await client.delete(
            f"/v1/customer-portal/customers/me/payment-methods/{payment_method.id}"
        )
        assert response.status_code == 401

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_delete_payment_method_not_found(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        # Try to delete a non-existent payment method with a valid UUID
        import uuid

        fake_id = str(uuid.uuid4())
        response = await client.delete(
            f"/v1/customer-portal/customers/me/payment-methods/{fake_id}"
        )
        assert response.status_code == 404

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    @pytest.mark.keep_session_state
    async def test_delete_payment_method_success(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
    ) -> None:
        # Create a payment method with no subscriptions
        payment_method = await create_payment_method(save_fixture, customer)

        response = await client.delete(
            f"/v1/customer-portal/customers/me/payment-methods/{payment_method.id}"
        )
        assert response.status_code == 204

        # Verify payment method is soft deleted
        await session.refresh(payment_method)
        assert payment_method.deleted_at is not None

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    @pytest.mark.keep_session_state
    async def test_delete_payment_method_with_active_subscription_and_alternative_succeeds(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        # Create two payment methods for the same customer
        payment_method_1 = await create_payment_method(save_fixture, customer)
        payment_method_2 = await create_payment_method(save_fixture, customer)

        # Create an active subscription using the first payment method
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        subscription.payment_method = payment_method_1
        await save_fixture(subscription)

        response = await client.delete(
            f"/v1/customer-portal/customers/me/payment-methods/{payment_method_1.id}"
        )
        assert response.status_code == 204

        # Verify payment method is soft deleted
        await session.refresh(payment_method_1)
        assert payment_method_1.deleted_at is not None

        # Verify subscription is reassigned to the alternative payment method
        await session.refresh(subscription)
        assert subscription.payment_method_id == payment_method_2.id

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    @pytest.mark.keep_session_state
    async def test_delete_payment_method_with_active_subscription_fails(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        # Create a payment method
        payment_method = await create_payment_method(save_fixture, customer)

        # Create an active subscription using this payment method
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        subscription.payment_method = payment_method
        await save_fixture(subscription)

        response = await client.delete(
            f"/v1/customer-portal/customers/me/payment-methods/{payment_method.id}"
        )
        assert response.status_code == 400

        # Check error message
        error_data = response.json()
        assert "Cannot delete payment method" in error_data["detail"]
        assert "no alternative payment methods" in error_data["detail"]

        # Verify payment method is NOT deleted
        await session.refresh(payment_method)
        assert payment_method.deleted_at is None

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    @pytest.mark.keep_session_state
    async def test_delete_payment_method_with_canceled_subscription_succeeds(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        # Create a payment method
        payment_method = await create_payment_method(save_fixture, customer)

        # Create a canceled subscription using this payment method
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.canceled,
        )
        subscription.payment_method = payment_method
        await save_fixture(subscription)

        response = await client.delete(
            f"/v1/customer-portal/customers/me/payment-methods/{payment_method.id}"
        )
        assert response.status_code == 204

        # Verify payment method is soft deleted
        await session.refresh(payment_method)
        assert payment_method.deleted_at is not None
