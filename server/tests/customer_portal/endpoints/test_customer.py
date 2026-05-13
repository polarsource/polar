from unittest.mock import MagicMock

import pytest
import pytest_asyncio
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.config import settings
from polar.customer_email_update.service import TOKEN_PREFIX
from polar.integrations.stripe.service import StripeService
from polar.kit.crypto import generate_token_hash_pair
from polar.models import Customer, Organization, Product
from polar.models.customer_email_verification import CustomerEmailVerification
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from tests.fixtures.auth import CUSTOMER_AUTH_SUBJECT
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_customer,
    create_payment_method,
    create_subscription,
)


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.payment_method.service.stripe_service", new=mock)
    mocker.patch("polar.customer_email_update.service.stripe_service", new=mock)
    mocker.patch("polar.customer_portal.service.customer.stripe_service", new=mock)
    return mock


@pytest_asyncio.fixture
async def organization_allow_email_change(
    save_fixture: SaveFixture, organization: Organization
) -> Organization:
    organization.customer_portal_settings = {
        **organization.customer_portal_settings,
        "customer": {"allow_email_change": True},
    }
    await save_fixture(organization)
    return organization


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


@pytest.mark.asyncio
class TestUpdateDefaultPaymentMethod:
    async def test_anonymous(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        customer: Customer,
    ) -> None:
        payment_method = await create_payment_method(save_fixture, customer)
        response = await client.patch(
            "/v1/customer-portal/customers/me",
            json={"default_payment_method_id": str(payment_method.id)},
        )
        assert response.status_code == 401

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    @pytest.mark.keep_session_state
    async def test_payment_method_not_found(
        self,
        client: AsyncClient,
    ) -> None:
        import uuid

        response = await client.patch(
            "/v1/customer-portal/customers/me",
            json={"default_payment_method_id": str(uuid.uuid4())},
        )
        assert response.status_code == 422

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    @pytest.mark.keep_session_state
    async def test_payment_method_not_owned_by_customer(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        other_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="other@example.com",
            stripe_customer_id="STRIPE_OTHER_CUSTOMER_ID",
        )
        other_payment_method = await create_payment_method(save_fixture, other_customer)

        response = await client.patch(
            "/v1/customer-portal/customers/me",
            json={"default_payment_method_id": str(other_payment_method.id)},
        )
        assert response.status_code == 422

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    @pytest.mark.keep_session_state
    async def test_null_default_payment_method_id_rejected(
        self,
        client: AsyncClient,
    ) -> None:
        response = await client.patch(
            "/v1/customer-portal/customers/me",
            json={"default_payment_method_id": None},
        )
        assert response.status_code == 422

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    @pytest.mark.keep_session_state
    async def test_success(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        stripe_service_mock: MagicMock,
    ) -> None:
        payment_method = await create_payment_method(save_fixture, customer)

        response = await client.patch(
            "/v1/customer-portal/customers/me",
            json={"default_payment_method_id": str(payment_method.id)},
        )
        assert response.status_code == 200

        body = response.json()
        assert body["default_payment_method_id"] == str(payment_method.id)

        await session.refresh(customer)
        assert customer.default_payment_method_id == payment_method.id

        stripe_service_mock.update_customer.assert_awaited_once()
        call_kwargs = stripe_service_mock.update_customer.await_args.kwargs
        assert call_kwargs["invoice_settings"] == {
            "default_payment_method": payment_method.processor_id,
        }


async def _create_verification(
    save_fixture: SaveFixture,
    customer: Customer,
    email: str = "new@example.com",
) -> tuple[CustomerEmailVerification, str]:
    token, token_hash = generate_token_hash_pair(
        secret=settings.SECRET, prefix=TOKEN_PREFIX
    )
    record = CustomerEmailVerification(
        email=email,
        token_hash=token_hash,
        customer_id=customer.id,
        organization_id=customer.organization_id,
    )
    await save_fixture(record)
    return record, token


@pytest.mark.asyncio
class TestRequestEmailUpdate:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/customer-portal/customers/me/email-update/request",
            json={"email": "new@example.com"},
        )
        assert response.status_code == 401

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    @pytest.mark.keep_session_state
    async def test_not_allowed(
        self,
        client: AsyncClient,
        customer: Customer,
    ) -> None:
        response = await client.post(
            "/v1/customer-portal/customers/me/email-update/request",
            json={"email": "brand-new@example.com"},
        )
        assert response.status_code == 403

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    @pytest.mark.keep_session_state
    async def test_request_email_update(
        self,
        client: AsyncClient,
        mocker: MockerFixture,
        customer: Customer,
        organization_allow_email_change: Organization,
    ) -> None:
        mocker.patch("polar.customer_email_update.service.enqueue_email_template")
        response = await client.post(
            "/v1/customer-portal/customers/me/email-update/request",
            json={"email": "brand-new@example.com"},
        )
        assert response.status_code == 202

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    @pytest.mark.keep_session_state
    async def test_same_email(
        self,
        client: AsyncClient,
        customer: Customer,
        organization_allow_email_change: Organization,
    ) -> None:
        response = await client.post(
            "/v1/customer-portal/customers/me/email-update/request",
            json={"email": customer.email},
        )
        assert response.status_code == 422


@pytest.mark.asyncio
class TestCheckEmailUpdate:
    async def test_valid_token(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        customer: Customer,
    ) -> None:
        _record, token = await _create_verification(save_fixture, customer)
        response = await client.get(
            "/v1/customer-portal/customers/me/email-update/check",
            params={"token": token},
        )
        assert response.status_code == 204

    async def test_invalid_token(self, client: AsyncClient) -> None:
        response = await client.get(
            "/v1/customer-portal/customers/me/email-update/check",
            params={"token": "polar_cev_bogus"},
        )
        assert response.status_code == 401


@pytest.mark.asyncio
class TestVerifyEmailUpdate:
    async def test_invalid_token(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/customer-portal/customers/me/email-update/verify",
            json={"token": "polar_cev_bogus"},
        )
        assert response.status_code == 401

    @pytest.mark.keep_session_state
    async def test_verify_success(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch("polar.customer_email_update.service.enqueue_email_template")
        _record, token = await _create_verification(
            save_fixture, customer, "verified@example.com"
        )
        response = await client.post(
            "/v1/customer-portal/customers/me/email-update/verify",
            json={"token": token},
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert len(data["token"]) > 0

    @pytest.mark.keep_session_state
    async def test_verify_email_taken(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch("polar.customer_email_update.service.enqueue_email_template")
        # Create another customer with the target email
        await create_customer(
            save_fixture,
            organization=organization,
            email="taken@example.com",
            stripe_customer_id="STRIPE_OTHER",
        )

        _record, token = await _create_verification(
            save_fixture, customer, "taken@example.com"
        )
        response = await client.post(
            "/v1/customer-portal/customers/me/email-update/verify",
            json={"token": token},
        )
        assert response.status_code == 422
