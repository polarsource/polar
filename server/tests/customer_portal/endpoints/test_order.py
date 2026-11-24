import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
import stripe as stripe_lib
from httpx2 import AsyncClient
from pytest_mock import MockerFixture

from polar.integrations.stripe.payment import handle_success
from polar.integrations.stripe.service import StripeService
from polar.kit.address import Address
from polar.kit.utils import utc_now
from polar.kit.visibility import Visibility
from polar.models import Customer, Organization, Product, Subscription
from polar.models.discount import DiscountDuration, DiscountType
from polar.models.order import OrderBillingReasonInternal, OrderStatus
from polar.models.payment import PaymentStatus
from polar.models.subscription import SubscriptionStatus
from polar.order.tasks import order_paid
from polar.postgres import AsyncSession
from polar.version import V2027_01
from tests.fixtures.auth import CUSTOMER_AUTH_SUBJECT
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
class TestOrderRecovery:
    async def test_trial_authentication_and_settlement(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        stripe_service_mock: MagicMock,
        mocker: MockerFixture,
    ) -> None:
        customer.stripe_customer_id = "cus_recovery"
        product.is_tax_applicable = False
        await save_fixture(customer)
        await save_fixture(product)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.trial_ended,
        )
        response = await client.post(
            "/v1/customer-portal/orders/",
            json={"subscription_id": str(subscription.id)},
        )
        assert response.status_code == 201, response.text
        draft = response.json()
        assert draft["status"] == OrderStatus.draft
        assert draft["invoice_number"] is None
        assert draft["applied_balance_amount"] == 0
        assert draft["due_amount"] == subscription.amount
        url = f"/v1/customer-portal/orders/{draft['id']}"

        response = await client.patch(url, json={"billing_name": "New billing name"})
        assert response.status_code == 200, response.text

        intent = stripe_lib.PaymentIntent.construct_from(
            {
                "id": "pi_recovery",
                "status": "requires_action",
                "client_secret": "pi_recovery_secret",
            },
            None,
        )
        stripe_service_mock.create_payment_intent.return_value = intent
        response = await client.patch(
            f"{url}/pay", json={"confirmation_token_id": "ctoken_recovery"}
        )
        assert response.status_code == 202, response.text
        assert response.json()["payment_processor_metadata"] == {
            "intent_id": intent.id,
            "intent_status": intent.status,
            "intent_client_secret": intent.client_secret,
        }
        assert (
            response.json()["subscription"]["status"] == SubscriptionStatus.trial_ended
        )
        stored_customer = await session.get(Customer, customer.id)
        assert stored_customer is not None
        assert stored_customer.billing_name != "New billing name"
        assert (
            await client.patch(url, json={"billing_name": "Unexpected edit"})
        ).status_code == 409
        assert (
            await client.patch(
                f"{url}/pay", json={"confirmation_token_id": "ctoken_recovery"}
            )
        ).status_code == 202
        stripe_service_mock.create_payment_intent.assert_awaited_once()
        stripe_service_mock.get_payment_intent.assert_not_awaited()

        charge = stripe_lib.Charge.construct_from(
            {
                "id": "ch_recovery",
                "status": "succeeded",
                "amount": draft["due_amount"],
                "currency": "usd",
                "payment_intent": intent.id,
                "billing_details": {"email": customer.email},
                "payment_method_details": {"type": "card", "card": {"last4": "4242"}},
                "outcome": None,
                "metadata": {
                    "organization_id": str(product.organization_id),
                    "order_id": draft["id"],
                },
            },
            None,
        )
        enqueue_job = mocker.patch("polar.integrations.stripe.payment.enqueue_job")
        await handle_success(session, charge)
        await session.flush()
        assert enqueue_job.call_args.args == ("order.paid",)
        await order_paid(**enqueue_job.call_args.kwargs)
        stored_customer = await session.get(Customer, customer.id)
        stored_subscription = await session.get(Subscription, subscription.id)
        assert stored_customer is not None
        assert stored_customer.billing_name == "New billing name"
        assert stored_subscription is not None
        assert stored_subscription.status == SubscriptionStatus.active

        response = await client.get(url)
        assert response.status_code == 200
        assert response.json()["status"] == OrderStatus.paid
        assert response.json()["invoice_number"] is not None
        assert response.json()["payment_processor_metadata"] == {}

    async def test_zero_due_draft_setup_decline_allows_edit_and_retry(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        stripe_service_mock: MagicMock,
        mocker: MockerFixture,
    ) -> None:
        customer.stripe_customer_id = "cus_recovery"
        product.is_tax_applicable = False
        await save_fixture(customer)
        await save_fixture(product)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.trial_ended,
        )
        await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            duration=DiscountDuration.once,
            basis_points=10_000,
            organization=product.organization,
            code="FIRSTFREE",
            max_redemptions=1,
        )
        response = await client.post(
            "/v1/customer-portal/orders/",
            json={"subscription_id": str(subscription.id)},
        )
        assert response.status_code == 201, response.text
        url = f"/v1/customer-portal/orders/{response.json()['id']}"
        response = await client.patch(url, json={"discount_code": "FIRSTFREE"})
        assert response.status_code == 200, response.text
        assert response.json()["due_amount"] == 0

        stripe_service_mock.create_setup_intent.side_effect = stripe_lib.CardError(
            "Declined", None, "card_declined"
        )
        response = await client.patch(
            f"{url}/pay", json={"confirmation_token_id": "ctoken_declined"}
        )
        assert response.status_code == 402, response.text
        assert response.json()["error"] == "CustomerOrderPaymentDeclined"
        response = await client.patch(
            url, json={"billing_name": "Edited after decline"}
        )
        assert response.status_code == 200, response.text
        assert response.json()["status"] == OrderStatus.draft
        assert response.json()["due_amount"] == 0

        intent = stripe_lib.SetupIntent.construct_from(
            {
                "id": "seti_succeeded",
                "status": "succeeded",
                "client_secret": "seti_succeeded_secret",
                "payment_method": {
                    "object": "payment_method",
                    "id": "pm_recovery",
                    "type": "card",
                    "card": {"last4": "4242"},
                },
                "metadata": {
                    "organization_id": str(product.organization_id),
                    "order_id": url.rsplit("/", 1)[-1],
                },
            },
            None,
        )
        stripe_service_mock.create_setup_intent.side_effect = None
        stripe_service_mock.create_setup_intent.return_value = intent
        response = await client.patch(
            f"{url}/pay",
            json={
                "confirmation_token_id": "ctoken_retry",
                "payment_processor": "stripe",
            },
        )
        assert response.status_code == 202, response.text
        assert response.json()["status"] == OrderStatus.pending

        enqueue_job = mocker.patch("polar.integrations.stripe.payment.enqueue_job")
        await handle_success(session, intent)
        await session.flush()
        assert enqueue_job.call_args.args == ("order.paid",)
        await order_paid(**enqueue_job.call_args.kwargs)

        response = await client.get(url)
        assert response.json()["status"] == OrderStatus.paid
        assert response.json()["subscription"]["status"] == SubscriptionStatus.active
        stored_subscription = await session.get(Subscription, subscription.id)
        assert stored_subscription is not None
        assert stored_subscription.payment_method_id is not None

    async def test_pending_order_preserves_tax_and_rejects_mixed_credentials(
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
            status=SubscriptionStatus.past_due,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            billing_reason=OrderBillingReasonInternal.subscription_cycle,
        )
        order.status = OrderStatus.pending
        order.billing_address = Address.model_validate({"country": "FR"})
        await save_fixture(order)
        url = f"/v1/customer-portal/orders/{order.id}"

        response = await client.patch(
            url, json={"billing_address": {"country": "FR", "line1": "10 Rue de Paris"}}
        )
        assert response.status_code == 200, response.text
        assert response.json()["due_amount"] == order.due_amount
        assert response.json()["tax_amount"] == order.tax_amount
        assert (
            await client.patch(url, json={"billing_address": {"country": "US"}})
        ).status_code == 422
        assert (await client.patch(url, json={"tax_id": "FR123"})).status_code == 409

        response = await client.patch(
            f"{url}/pay",
            json={
                "confirmation_token_id": "ctoken_test",
                "payment_method_id": str(uuid.uuid4()),
            },
        )
        assert response.status_code == 422


@pytest.mark.anyio
class TestGetOrder:
    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
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
