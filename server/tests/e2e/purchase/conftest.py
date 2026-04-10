"""Shared constants and helpers for purchase E2E tests."""

from dataclasses import dataclass
from typing import Any

from httpx import AsyncClient

from polar.kit.db.postgres import AsyncSession
from polar.models import Organization, Product
from tests.e2e.infra import DrainFn, StripeSimulator

BUYER_EMAIL = "buyer@example.com"
BUYER_NAME = "Test Buyer"
BILLING_ADDRESS = {
    "country": "US",
    "city": "San Francisco",
    "postal_code": "94105",
    "line1": "123 Market St",
    "state": "CA",
}


@dataclass
class CompletedPurchase:
    """Result of a completed purchase flow."""

    checkout_id: str
    order_id: str
    order: dict[str, Any]  # Full order JSON from API
    customer_session_token: str | None = None


async def complete_purchase(
    client: AsyncClient,
    session: AsyncSession,
    stripe_sim: StripeSimulator,
    drain: DrainFn,
    organization: Organization,
    product: Product,
    *,
    amount: int,
    discount_id: str | None = None,
    seats: int | None = None,
) -> CompletedPurchase:
    """
    Run the full purchase flow: checkout → confirm → webhook → drain.

    Returns a CompletedPurchase with checkout_id, order_id, and the full
    order JSON. Use this to avoid duplicating the 4-step ceremony in tests.
    """
    checkout_body: dict[str, Any] = {"products": [str(product.id)]}
    if discount_id is not None:
        checkout_body["discount_id"] = discount_id
    if seats is not None:
        checkout_body["seats"] = seats

    response = await client.post("/v1/checkouts/", json=checkout_body)
    assert response.status_code == 201, response.text
    checkout_data = response.json()
    checkout_id = checkout_data["id"]
    client_secret = checkout_data["client_secret"]
    await drain()

    stripe_sim.expect_payment(
        amount=amount,
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
    customer_session_token = response.json().get("customer_session_token")
    await drain()

    await stripe_sim.send_charge_webhook(
        session, organization_id=organization.id, checkout_id=checkout_id
    )
    await drain()

    response = await client.get("/v1/orders/")
    assert response.status_code == 200
    orders = response.json()
    assert orders["pagination"]["total_count"] >= 1
    order = orders["items"][0]

    return CompletedPurchase(
        checkout_id=checkout_id,
        order_id=order["id"],
        order=order,
        customer_session_token=customer_session_token,
    )
