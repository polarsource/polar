"""
E2E: One-time purchase — payment failure.

When a charge fails, no order should be created and the checkout
should return to open status so the customer can retry.
"""

from uuid import UUID

import pytest
import stripe as stripe_lib
from httpx import AsyncClient

from polar.checkout.repository import CheckoutRepository
from polar.discount.repository import DiscountRedemptionRepository
from polar.enums import PaymentProcessor
from polar.kit.db.postgres import AsyncSession
from polar.models import Organization, Product
from polar.models.checkout import CheckoutStatus
from polar.models.discount import DiscountDuration, DiscountType
from polar.models.payment import PaymentStatus
from polar.payment.repository import PaymentRepository
from tests.e2e.conftest import E2E_AUTH
from tests.e2e.infra import DrainFn, StripeSimulator
from tests.e2e.infra.stripe_simulator import simulate_webhook
from tests.e2e.purchase.conftest import BILLING_ADDRESS, BUYER_EMAIL, BUYER_NAME
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_discount
from tests.fixtures.stripe import build_stripe_charge


@pytest.mark.asyncio
class TestPaymentFailure:
    @E2E_AUTH
    async def test_stale_failure_does_not_block_fulfillment(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        stripe_sim: StripeSimulator,
        drain: DrainFn,
        organization: Organization,
        one_time_product: Product,
    ) -> None:
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=2000,
            duration=DiscountDuration.once,
            organization=organization,
            products=[one_time_product],
        )
        response = await client.post(
            "/v1/checkouts/",
            json={
                "products": [str(one_time_product.id)],
                "discount_id": str(discount.id),
            },
        )
        assert response.status_code == 201, response.text
        checkout_id = response.json()["id"]
        client_secret = response.json()["client_secret"]
        await drain()

        stripe_sim.expect_payment(amount=2000)
        failed_charge = stripe_sim.build_charge(
            organization_id=organization.id, checkout_id=checkout_id
        )
        failed_charge.id = "ch_stale"
        failed_charge.status = "failed"
        stripe_sim.mock.create_payment_intent.side_effect = stripe_lib.CardError(
            "Incorrect CVC", param="cvc", code="incorrect_cvc"
        )
        confirm_payload = {
            "confirmation_token_id": "tok_test_confirm",
            "customer_email": BUYER_EMAIL,
            "customer_billing_address": BILLING_ADDRESS,
        }
        response = await client.post(
            f"/v1/checkouts/client/{client_secret}/confirm", json=confirm_payload
        )
        assert response.status_code == 400, response.text

        stripe_sim.mock.create_payment_intent.side_effect = None
        stripe_sim.payment_intent_id = "pi_new"
        stripe_sim.expect_payment(amount=2000)
        response = await client.post(
            f"/v1/checkouts/client/{client_secret}/confirm", json=confirm_payload
        )
        assert response.status_code == 200, response.text
        await drain()

        repository = CheckoutRepository.from_session(session)
        checkout = await repository.get_by_id(UUID(checkout_id))
        assert checkout is not None
        metadata = checkout.payment_processor_metadata.copy()
        assert metadata["intent_id"] == "pi_new"
        redemption_repository = DiscountRedemptionRepository.from_session(session)
        redemption = await redemption_repository.get_one(
            redemption_repository.get_base_statement().where(
                redemption_repository.model.checkout_id == checkout.id
            )
        )

        await simulate_webhook(session, "charge.failed", failed_charge)
        await drain()
        checkout = await repository.get_by_id(UUID(checkout_id))
        assert checkout is not None
        assert checkout.status == CheckoutStatus.confirmed
        assert checkout.payment_processor_metadata == metadata
        assert await redemption_repository.get_by_id(redemption.id) is not None
        payment = await PaymentRepository.from_session(session).get_by_processor_id(
            PaymentProcessor.stripe, failed_charge.id
        )
        assert payment is not None
        assert payment.status == PaymentStatus.failed

        await stripe_sim.send_charge_webhook(
            session, organization_id=organization.id, checkout_id=checkout_id
        )
        await drain()
        response = await client.get(f"/v1/checkouts/{checkout_id}")
        assert response.status_code == 200, response.text
        assert response.json()["status"] == "succeeded"
        response = await client.get("/v1/orders/")
        assert response.status_code == 200, response.text
        assert response.json()["pagination"]["total_count"] == 1
        assert response.json()["items"][0]["status"] == "paid"

    @E2E_AUTH
    async def test_no_order_created_on_failed_charge(
        self,
        client: AsyncClient,
        session: AsyncSession,
        stripe_sim: StripeSimulator,
        drain: DrainFn,
        organization: Organization,
        one_time_product: Product,
    ) -> None:
        # Given a checkout that has been confirmed
        response = await client.post(
            "/v1/checkouts/",
            json={"products": [str(one_time_product.id)]},
        )
        assert response.status_code == 201, response.text
        checkout_id = response.json()["id"]
        client_secret = response.json()["client_secret"]
        await drain()

        stripe_sim.expect_payment(
            amount=2500,
            customer_name=BUYER_NAME,
            customer_email=BUYER_EMAIL,
            billing_address=BILLING_ADDRESS,
        )
        response = await client.post(
            f"/v1/checkouts/client/{client_secret}/confirm",
            json={
                "confirmation_token_id": "tok_test_confirm",
                "customer_email": BUYER_EMAIL,
                "customer_billing_address": BILLING_ADDRESS,
            },
        )
        assert response.status_code == 200, response.text
        assert response.json()["status"] == "confirmed"
        await drain()

        # When the charge fails
        failed_charge = build_stripe_charge(
            status="failed",
            amount=2500,
            customer=stripe_sim.customer_id,
            payment_intent=stripe_sim.payment_intent_id,
            metadata={
                "type": "product",
                "organization_id": str(organization.id),
                "checkout_id": checkout_id,
                "tax_amount": "0",
                "tax_country": "US",
            },
            billing_details={
                "name": BUYER_NAME,
                "email": BUYER_EMAIL,
                "address": BILLING_ADDRESS,
            },
            payment_method_details={
                "type": "card",
                "card": {
                    "brand": "visa",
                    "last4": "4242",
                    "exp_month": 12,
                    "exp_year": 2030,
                    "country": "US",
                },
            },
            outcome={
                "network_status": "declined_by_network",
                "type": "issuer_declined",
                "reason": "insufficient_funds",
                "seller_message": "The card was declined.",
            },
        )
        failed_charge["object"] = "charge"
        failed_charge["payment_method"] = "pm_e2e_test"

        await simulate_webhook(session, "charge.failed", failed_charge)
        await drain()

        # Then no order is created
        response = await client.get("/v1/orders/")
        assert response.status_code == 200
        assert response.json()["pagination"]["total_count"] == 0

        # And the checkout returns to open so the customer can retry
        response = await client.get(f"/v1/checkouts/{checkout_id}")
        assert response.status_code == 200
        assert response.json()["status"] == "open"
