import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
import stripe as stripe_lib
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.integrations.stripe.service import StripeService
from polar.kit.utils import utc_now
from polar.models import Customer, Product
from polar.models.order import OrderStatus
from polar.models.payment import PaymentStatus
from polar.postgres import AsyncSession
from tests.fixtures.auth import CUSTOMER_AUTH_SUBJECT
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_order,
    create_payment,
    create_subscription,
)


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.order.service.stripe_service", new=mock)
    return mock


@pytest.mark.asyncio
class TestGetPaymentStatus:
    async def test_anonymous(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        response = await client.get(
            f"/v1/customer-portal/orders/{order.id}/payment-status"
        )
        assert response.status_code == 401

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_other_customer_order(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer_second: Customer,
    ) -> None:
        order = await create_order(
            save_fixture, product=product, customer=customer_second
        )
        response = await client.get(
            f"/v1/customer-portal/orders/{order.id}/payment-status"
        )
        assert response.status_code == 404

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_nonexistent_order(self, client: AsyncClient) -> None:
        non_existing_id = uuid.uuid4()
        response = await client.get(
            f"/v1/customer-portal/orders/{non_existing_id}/payment-status"
        )
        assert response.status_code == 404

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_order_no_payment(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        response = await client.get(
            f"/v1/customer-portal/orders/{order.id}/payment-status"
        )
        assert response.status_code == 200

        json = response.json()
        assert json["status"] == "no_payment"
        assert json["error"] is None

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_order_with_successful_payment(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        await create_payment(
            save_fixture,
            organization=product.organization,
            order=order,
            status=PaymentStatus.succeeded,
        )

        response = await client.get(
            f"/v1/customer-portal/orders/{order.id}/payment-status"
        )
        assert response.status_code == 200

        json = response.json()
        assert json["status"] == "succeeded"
        assert json["error"] is None

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_order_with_failed_payment(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        await create_payment(
            save_fixture,
            organization=product.organization,
            order=order,
            status=PaymentStatus.failed,
            decline_message="Your card was declined.",
        )

        response = await client.get(
            f"/v1/customer-portal/orders/{order.id}/payment-status"
        )
        assert response.status_code == 200

        json = response.json()
        assert json["status"] == "failed"
        assert json["error"] == "Your card was declined."


@pytest.mark.asyncio
class TestConfirmRetryPayment:
    async def test_anonymous(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        response = await client.post(
            f"/v1/customer-portal/orders/{order.id}/confirm-payment",
            json={"confirmation_token_id": "ctoken_test"},
        )
        assert response.status_code == 401

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_other_customer_order(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer_second: Customer,
    ) -> None:
        order = await create_order(
            save_fixture, product=product, customer=customer_second
        )
        response = await client.post(
            f"/v1/customer-portal/orders/{order.id}/confirm-payment",
            json={"confirmation_token_id": "ctoken_test"},
        )
        assert response.status_code == 404

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_nonexistent_order(self, client: AsyncClient) -> None:
        non_existing_id = uuid.uuid4()
        response = await client.post(
            f"/v1/customer-portal/orders/{non_existing_id}/confirm-payment",
            json={"confirmation_token_id": "ctoken_test"},
        )
        assert response.status_code == 404

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_successful_payment(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        stripe_service_mock: MagicMock,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        order.status = OrderStatus.pending
        order.next_payment_attempt_at = utc_now()
        order.customer.stripe_customer_id = "cus_test"
        await save_fixture(order)

        subscription = await create_subscription(
            save_fixture, customer=order.customer, product=product
        )
        order.subscription = subscription
        await save_fixture(order)

        mock_payment_intent = MagicMock()
        mock_payment_intent.id = "pi_test"
        mock_payment_intent.status = "succeeded"
        mock_payment_intent.client_secret = None
        stripe_service_mock.create_payment_intent = AsyncMock(
            return_value=mock_payment_intent
        )

        response = await client.post(
            f"/v1/customer-portal/orders/{order.id}/confirm-payment",
            json={"confirmation_token_id": "ctoken_test"},
        )
        assert response.status_code == 200

        json = response.json()
        assert json["status"] == "succeeded"
        assert json["client_secret"] is None
        assert json["error"] is None

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_payment_requires_action(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        stripe_service_mock: MagicMock,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        order.status = OrderStatus.pending
        order.next_payment_attempt_at = utc_now()
        order.customer.stripe_customer_id = "cus_test"
        await save_fixture(order)

        subscription = await create_subscription(
            save_fixture, customer=order.customer, product=product
        )
        order.subscription = subscription
        await save_fixture(order)

        mock_payment_intent = MagicMock()
        mock_payment_intent.id = "pi_test"
        mock_payment_intent.status = "requires_action"
        mock_payment_intent.client_secret = "pi_test_client_secret"
        stripe_service_mock.create_payment_intent = AsyncMock(
            return_value=mock_payment_intent
        )

        response = await client.post(
            f"/v1/customer-portal/orders/{order.id}/confirm-payment",
            json={"confirmation_token_id": "ctoken_test"},
        )
        assert response.status_code == 200

        json = response.json()
        assert json["status"] == "requires_action"
        assert json["client_secret"] == "pi_test_client_secret"
        assert json["error"] is None

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_failed_payment(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        stripe_service_mock: MagicMock,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        order.status = OrderStatus.pending
        order.next_payment_attempt_at = utc_now()
        order.customer.stripe_customer_id = "cus_test"
        await save_fixture(order)

        subscription = await create_subscription(
            save_fixture, customer=order.customer, product=product
        )
        order.subscription = subscription
        await save_fixture(order)

        mock_payment_intent = MagicMock()
        mock_payment_intent.id = "pi_test"
        mock_payment_intent.status = "failed"
        mock_payment_intent.client_secret = None
        mock_payment_intent.last_payment_error = MagicMock()
        mock_payment_intent.last_payment_error.message = "Your card was declined."
        stripe_service_mock.create_payment_intent = AsyncMock(
            return_value=mock_payment_intent
        )

        response = await client.post(
            f"/v1/customer-portal/orders/{order.id}/confirm-payment",
            json={"confirmation_token_id": "ctoken_test"},
        )
        assert response.status_code == 200

        json = response.json()
        assert json["status"] == "failed"
        assert json["client_secret"] is None
        assert json["error"] == "Your card was declined."

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_stripe_error(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        stripe_service_mock: MagicMock,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        order.status = OrderStatus.pending
        order.next_payment_attempt_at = utc_now()
        order.customer.stripe_customer_id = "cus_test"
        await save_fixture(order)

        subscription = await create_subscription(
            save_fixture, customer=order.customer, product=product
        )
        order.subscription = subscription
        await save_fixture(order)

        mock_error = MagicMock()
        mock_error.message = "Payment method not available."
        stripe_error = stripe_lib.StripeError("Payment method not available.")
        stripe_error.error = mock_error
        stripe_service_mock.create_payment_intent = AsyncMock(side_effect=stripe_error)

        response = await client.post(
            f"/v1/customer-portal/orders/{order.id}/confirm-payment",
            json={"confirmation_token_id": "ctoken_test"},
        )
        assert response.status_code == 200

        json = response.json()
        assert json["status"] == "failed"
        assert json["client_secret"] is None
        assert json["error"] == "Payment method not available."

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_order_not_pending(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        order.status = OrderStatus.paid
        await save_fixture(order)

        response = await client.post(
            f"/v1/customer-portal/orders/{order.id}/confirm-payment",
            json={"confirmation_token_id": "ctoken_test"},
        )
        assert response.status_code == 422

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_order_no_next_payment_attempt(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        order.status = OrderStatus.pending
        order.next_payment_attempt_at = None
        await save_fixture(order)

        response = await client.post(
            f"/v1/customer-portal/orders/{order.id}/confirm-payment",
            json={"confirmation_token_id": "ctoken_test"},
        )
        assert response.status_code == 422

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_order_no_subscription(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        order.status = OrderStatus.pending
        order.next_payment_attempt_at = utc_now()
        order.subscription = None
        await save_fixture(order)

        response = await client.post(
            f"/v1/customer-portal/orders/{order.id}/confirm-payment",
            json={"confirmation_token_id": "ctoken_test"},
        )
        assert response.status_code == 422

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_payment_already_in_progress(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        customer.stripe_customer_id = "cus_test"
        await save_fixture(customer)

        subscription = await create_subscription(
            save_fixture, customer=customer, product=product
        )

        order = await create_order(
            save_fixture, product=product, customer=customer, subscription=subscription
        )
        order.status = OrderStatus.pending
        order.next_payment_attempt_at = utc_now()
        order.payment_lock_acquired_at = utc_now()
        await save_fixture(order)

        response = await client.post(
            f"/v1/customer-portal/orders/{order.id}/confirm-payment",
            json={"confirmation_token_id": "ctoken_test"},
        )
        assert response.status_code >= 409
