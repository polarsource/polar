import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
import stripe as stripe_lib
from httpx2 import AsyncClient
from pytest_mock import MockerFixture

from polar.integrations.stripe.service import StripeService
from polar.kit.address import Address
from polar.kit.utils import utc_now
from polar.kit.visibility import Visibility
from polar.models import Customer, Organization, Product, Subscription
from polar.models.discount import DiscountDuration, DiscountType
from polar.models.order import OrderStatus
from polar.models.payment import PaymentStatus
from polar.models.subscription import SubscriptionStatus
from polar.order.tasks import order_paid
from polar.postgres import AsyncSession
from polar.version import V2026_10, V2027_01
from tests.fixtures.auth import CUSTOMER_AUTH_SUBJECT, MEMBER_AUTH_SUBJECT
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit,
    create_discount,
    create_order,
    create_payment,
    create_subscription,
    set_product_benefits,
)


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.order.service.stripe_service", new=mock)
    return mock


@pytest.mark.anyio
@pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
@pytest.mark.api_version(V2027_01)
class TestCreateOrder:
    async def test_creates_draft_for_ended_trial(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        stripe_service_mock: MagicMock,
    ) -> None:
        product.is_tax_applicable = False
        customer.billing_name = "Customer billing name"
        customer.billing_address = Address.model_validate({"country": "FR"})
        await save_fixture(product)
        await save_fixture(customer)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.trial_ended,
        )
        payload = {"subscription_id": str(subscription.id)}

        response = await client.post("/v1/customer-portal/orders/", json=payload)

        assert response.status_code == 201, response.text
        draft = response.json()
        assert draft["status"] == OrderStatus.draft
        assert draft["subscription"]["id"] == str(subscription.id)
        assert draft["invoice_number"] is None
        assert draft["applied_balance_amount"] == 0
        assert draft["due_amount"] == subscription.amount
        assert draft["is_payment_required"] is True
        assert draft["is_payment_setup_required"] is True
        assert draft["billing_name"] == customer.billing_name
        assert draft["billing_address"]["country"] == "FR"
        assert sum(item["amount"] for item in draft["items"]) == subscription.amount
        stored_subscription = await session.get(Subscription, subscription.id)
        assert stored_subscription is not None
        assert stored_subscription.status == SubscriptionStatus.trial_ended
        stripe_service_mock.create_payment_intent.assert_not_awaited()

        response = await client.post("/v1/customer-portal/orders/", json=payload)
        assert response.status_code == 422, response.text
        error = response.json()["detail"][0]
        assert error["loc"] == ["body", "subscription_id"]
        assert error["msg"] == "A draft order already exists for this subscription."

    async def test_rejects_subscription_whose_trial_has_not_ended(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
        )

        response = await client.post(
            "/v1/customer-portal/orders/",
            json={"subscription_id": str(subscription.id)},
        )

        assert response.status_code == 422, response.text
        error = response.json()["detail"][0]
        assert error["loc"] == ["body", "subscription_id"]
        assert (
            error["msg"]
            == "This subscription's trial has not ended without converting."
        )

    async def test_hides_other_customers_subscription(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer_second: Customer,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer_second,
            status=SubscriptionStatus.trial_ended,
        )

        response = await client.post(
            "/v1/customer-portal/orders/",
            json={"subscription_id": str(subscription.id)},
        )

        assert response.status_code == 422, response.text
        error = response.json()["detail"][0]
        assert error["loc"] == ["body", "subscription_id"]
        assert error["msg"] == "Subscription not found."

    @pytest.mark.auth(MEMBER_AUTH_SUBJECT)
    async def test_non_billing_member_cannot_create_order(
        self, client: AsyncClient
    ) -> None:
        response = await client.post(
            "/v1/customer-portal/orders/", json={"subscription_id": str(uuid.uuid4())}
        )

        assert response.status_code == 403, response.text


@pytest.mark.anyio
@pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
@pytest.mark.api_version(V2027_01)
class TestPayOrder:
    async def test_decline_returns_payment_required(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        stripe_service_mock: MagicMock,
    ) -> None:
        customer.stripe_customer_id = "cus_test"
        await save_fixture(customer)
        subscription = await create_subscription(
            save_fixture, customer=customer, product=product
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
            billing_address=Address.model_validate({"country": "FR"}),
        )
        stripe_service_mock.create_payment_intent.side_effect = stripe_lib.CardError(
            "Card declined.", param=None, code="card_declined"
        )

        response = await client.patch(
            f"/v1/customer-portal/orders/{order.id}/pay",
            json={
                "payment_processor": "stripe",
                "confirmation_token_id": "ctoken_test",
            },
        )

        assert response.status_code == 402, response.text
        assert response.json()["error"] == "PaymentError"

    async def test_rejects_nonexistent_payment_method(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_subscription(
            save_fixture, customer=customer, product=product
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
            billing_address=Address.model_validate({"country": "FR"}),
        )
        payment_method_id = str(uuid.uuid4())

        response = await client.patch(
            f"/v1/customer-portal/orders/{order.id}/pay",
            json={"payment_method_id": payment_method_id},
        )

        assert response.status_code == 422, response.text
        assert response.json() == {
            "error": "PolarRequestValidationError",
            "detail": [
                {
                    "type": "value_error",
                    "loc": ["body", "payment_method_id"],
                    "msg": "Payment method does not exist or doesn't belong to customer",
                    "input": payment_method_id,
                }
            ],
        }

    async def test_rejects_paid_order(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.paid,
            billing_address=Address.model_validate({"country": "FR"}),
        )

        response = await client.patch(
            f"/v1/customer-portal/orders/{order.id}/pay",
            json={
                "payment_processor": "stripe",
                "confirmation_token_id": "ctoken_test",
            },
        )

        assert response.status_code == 409, response.text
        assert response.json()["error"] == "OrderNotEligibleForRetry"

    async def test_returns_pending_order_after_stripe_accepts_payment(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        stripe_service_mock: MagicMock,
    ) -> None:
        customer.stripe_customer_id = "cus_test"
        await save_fixture(customer)
        subscription = await create_subscription(
            save_fixture, customer=customer, product=product
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
            next_payment_attempt_at=utc_now(),
            billing_address=Address.model_validate({"country": "FR"}),
        )
        stripe_service_mock.create_payment_intent.return_value = (
            stripe_lib.PaymentIntent.construct_from(
                {"id": "pi_test", "status": "succeeded", "client_secret": None},
                None,
            )
        )

        response = await client.patch(
            f"/v1/customer-portal/orders/{order.id}/pay",
            json={
                "payment_processor": "stripe",
                "confirmation_token_id": "ctoken_test",
            },
        )

        assert response.status_code == 202, response.text
        assert response.json()["id"] == str(order.id)
        assert response.json()["status"] == OrderStatus.pending
        assert response.json()["payment_processor_metadata"] == {
            "intent_id": "pi_test",
            "intent_status": "succeeded",
        }
        stripe_service_mock.create_payment_intent.assert_awaited_once()

    async def test_zero_due_recurring_order_creates_setup_intent(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        stripe_service_mock: MagicMock,
    ) -> None:
        subscription = await create_subscription(
            save_fixture, customer=customer, product=product
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
            subtotal_amount=0,
            billing_address=Address.model_validate({"country": "FR"}),
        )
        stripe_service_mock.create_setup_intent.return_value = (
            stripe_lib.SetupIntent.construct_from(
                {
                    "id": "seti_test",
                    "status": "requires_action",
                    "client_secret": "seti_test_secret",
                },
                None,
            )
        )

        response = await client.patch(
            f"/v1/customer-portal/orders/{order.id}/pay",
            json={
                "payment_processor": "stripe",
                "confirmation_token_id": "ctoken_test",
            },
        )

        assert response.status_code == 202, response.text
        assert response.json()["status"] == OrderStatus.pending
        assert response.json()["payment_processor_metadata"] == {
            "intent_id": "seti_test",
            "intent_status": "requires_action",
            "intent_client_secret": "seti_test_secret",
        }
        stripe_service_mock.create_setup_intent.assert_awaited_once()
        stripe_service_mock.create_payment_intent.assert_not_awaited()

    async def test_free_trial_draft_queues_settlement_without_stripe(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product_recurring_free_price: Product,
        customer: Customer,
        stripe_service_mock: MagicMock,
        mocker: MockerFixture,
    ) -> None:
        customer.billing_address = None
        await save_fixture(customer)
        subscription = await create_subscription(
            save_fixture,
            customer=customer,
            product=product_recurring_free_price,
            status=SubscriptionStatus.trial_ended,
        )
        draft = await client.post(
            "/v1/customer-portal/orders/",
            json={"subscription_id": str(subscription.id)},
        )
        assert draft.status_code == 201, draft.text
        order_id = uuid.UUID(draft.json()["id"])
        url = f"/v1/customer-portal/orders/{order_id}"
        enqueue = mocker.patch("polar.customer_portal.service.order.enqueue_job")

        response = await client.patch(f"{url}/pay", json={})

        assert response.status_code == 202, response.text
        assert response.json()["status"] == OrderStatus.pending
        enqueue.assert_called_once_with("order.paid", order_id=order_id)
        stripe_service_mock.create_customer.assert_not_awaited()
        stripe_service_mock.create_payment_intent.assert_not_awaited()
        stripe_service_mock.create_setup_intent.assert_not_awaited()

        await order_paid(order_id)

        response = await client.get(url)
        assert response.status_code == 200, response.text
        assert response.json()["status"] == OrderStatus.paid
        assert response.json()["subscription"]["status"] == SubscriptionStatus.active

    async def test_hides_other_customers_order(
        self, client: AsyncClient, save_fixture: SaveFixture, customer_second: Customer
    ) -> None:
        order = await create_order(save_fixture, customer=customer_second)

        response = await client.patch(
            f"/v1/customer-portal/orders/{order.id}/pay",
            json={
                "payment_processor": "stripe",
                "confirmation_token_id": "ctoken_test",
            },
        )

        assert response.status_code == 404, response.text


@pytest.mark.anyio
@pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
class TestListOrders:
    @pytest.mark.api_version(V2027_01)
    async def test_status_filter(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        paid_order = await create_order(
            save_fixture, product=product, customer=customer, status=OrderStatus.paid
        )
        refunded_order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.refunded,
        )
        await create_order(
            save_fixture, product=product, customer=customer, status=OrderStatus.pending
        )

        response = await client.get(
            "/v1/customer-portal/orders/",
            params={"status": ["paid", "refunded"]},
        )

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 2
        assert {item["id"] for item in json["items"]} == {
            str(paid_order.id),
            str(refunded_order.id),
        }

    @pytest.mark.api_version(V2026_10)
    async def test_status_filter_ignored_before_v2027_01(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        await create_order(
            save_fixture, product=product, customer=customer, status=OrderStatus.paid
        )
        await create_order(
            save_fixture, product=product, customer=customer, status=OrderStatus.pending
        )

        response = await client.get(
            "/v1/customer-portal/orders/", params={"status": "paid"}
        )

        assert response.status_code == 200
        assert response.json()["pagination"]["total_count"] == 2


@pytest.mark.anyio
class TestGetOrder:
    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    @pytest.mark.api_version(V2026_10)
    async def test_excludes_non_public_benefits(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        public_benefit = await create_benefit(
            save_fixture, organization=organization, description="Public benefit"
        )
        private_benefit = await create_benefit(
            save_fixture, organization=organization, description="Private benefit"
        )
        private_benefit.visibility = Visibility.private
        await save_fixture(private_benefit)
        await set_product_benefits(
            save_fixture,
            product=product,
            benefits=[public_benefit, private_benefit],
        )

        order = await create_order(save_fixture, product=product, customer=customer)

        response = await client.get(f"/v1/customer-portal/orders/{order.id}")

        assert response.status_code == 200

        json = response.json()
        assert "is_payment_required" not in json
        assert "is_payment_setup_required" not in json
        assert "payment_processor_metadata" not in json
        benefit_ids = {benefit["id"] for benefit in json["product"]["benefits"]}
        assert str(public_benefit.id) in benefit_ids
        assert str(private_benefit.id) not in benefit_ids


@pytest.mark.anyio
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


@pytest.mark.anyio
class TestConfirmRetryPayment:
    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_missing_payment_method_preserves_legacy_error(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_subscription(
            save_fixture, customer=customer, product=product
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )

        response = await client.post(
            f"/v1/customer-portal/orders/{order.id}/confirm-payment",
            json={"payment_method_id": str(uuid.uuid4())},
        )

        assert response.status_code == 422, response.text
        assert response.json() == {
            "error": "PaymentRetryValidationError",
            "detail": "Payment method does not belong to customer",
        }

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_ended_subscription(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        stripe_service_mock: MagicMock,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            customer=customer,
            product=product,
            status=SubscriptionStatus.canceled,
            ended_at=utc_now(),
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )

        response = await client.post(
            f"/v1/customer-portal/orders/{order.id}/confirm-payment",
            json={"confirmation_token_id": "ctoken_test"},
        )

        assert response.status_code == 422, response.text
        assert response.json()["error"] == "OrderNotEligibleForRetry"
        stripe_service_mock.create_payment_intent.assert_not_awaited()

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
    async def test_successful_payment_without_scheduled_retry(
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
        mock_payment_intent.status = "processing"
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
        assert json["status"] == "failed"
        assert json["client_secret"] is None
        assert json["error"] == "Payment failed"

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


@pytest.mark.anyio
class TestGetOrderReceipt:
    async def test_anonymous(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        response = await client.get(f"/v1/customer-portal/orders/{order.id}/receipt")
        assert response.status_code == 401

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_other_customer_order(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer_second: Customer,
    ) -> None:
        order = await create_order(
            save_fixture, product=product, customer=customer_second
        )
        order.receipt_number = "RCPT-FOO-0001"
        await save_fixture(order)
        response = await client.get(f"/v1/customer-portal/orders/{order.id}/receipt")
        assert response.status_code == 404

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_404_when_no_receipt_number(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        response = await client.get(f"/v1/customer-portal/orders/{order.id}/receipt")
        assert response.status_code == 404

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_202_when_pending_render(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        order.receipt_number = "RCPT-FOO-0001"
        await save_fixture(order)

        enqueue_mock = mocker.patch("polar.receipt.service.enqueue_job")

        response = await client.get(f"/v1/customer-portal/orders/{order.id}/receipt")

        assert response.status_code == 202
        enqueue_mock.assert_called_once_with("receipt.render", order_id=order.id)

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_200_when_receipt_ready(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        order.receipt_number = "RCPT-FOO-0001"
        order.receipt_path = f"{order.organization_id}/{order.id}/receipt.pdf"
        await save_fixture(order)

        s3_mock = mocker.patch("polar.receipt.service.S3Service")
        s3_mock.return_value.generate_presigned_download_url.return_value = (
            "https://example.com/signed-url",
            datetime(2030, 1, 1, tzinfo=UTC),
        )

        response = await client.get(f"/v1/customer-portal/orders/{order.id}/receipt")

        assert response.status_code == 200
        assert response.json() == {"url": "https://example.com/signed-url"}


@pytest.mark.anyio
@pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
@pytest.mark.api_version(V2027_01)
class TestUpdateOrder:
    async def test_draft_billing_details_and_discount(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        product.is_tax_applicable = False
        await save_fixture(product)
        await create_discount(
            save_fixture,
            organization=product.organization,
            type=DiscountType.percentage,
            duration=DiscountDuration.once,
            basis_points=2_500,
            code="DRAFT25",
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.draft,
            subscription=await create_subscription(
                save_fixture, product=product, customer=customer
            ),
            billing_address=Address.model_validate({"country": "US"}),
        )
        url = f"/v1/customer-portal/orders/{order.id}"

        response = await client.patch(
            url,
            json={
                "billing_name": "French company",
                "billing_address": {"country": "FR"},
                "tax_id": "FR61954506077",
                "discount_code": "DRAFT25",
            },
        )
        assert response.status_code == 200, response.text
        draft = response.json()
        assert draft["status"] == OrderStatus.draft
        assert draft["billing_name"] == "French company"
        assert draft["billing_address"]["country"] == "FR"
        assert draft["tax_id"] == ["FR61954506077", "eu_vat"]
        assert draft["discount_amount"] == 250
        assert draft["due_amount"] == 750

        response = await client.patch(url, json={"tax_id": None, "discount_code": None})
        assert response.status_code == 200, response.text
        assert response.json()["tax_id"] is None
        assert response.json()["discount_amount"] == 0
        assert response.json()["due_amount"] == 1000

    async def test_pending_order_rejects_repricing_fields(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            billing_address=Address.model_validate({"country": "FR"}),
            tax_amount=200,
        )

        response = await client.patch(
            f"/v1/customer-portal/orders/{order.id}",
            json={
                "tax_id": None,
                "discount_code": None,
                "billing_address": {"country": "US"},
            },
        )
        assert response.status_code == 422, response.text
        assert [error["loc"] for error in response.json()["detail"]] == [
            ["body", "tax_id"],
            ["body", "discount_code"],
            ["body", "billing_address", "country"],
        ]
