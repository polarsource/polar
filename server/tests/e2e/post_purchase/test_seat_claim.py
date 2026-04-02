"""
E2E: Post-purchase — seat claiming.

After a seat-based one-time order is paid, the buyer assigns a seat
to a recipient via email. The recipient claims the seat with an
invitation token, which triggers benefit grants.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.kit.db.postgres import AsyncSession
from polar.models import Organization, Product, User
from tests.e2e.infra import DrainFn, StripeSimulator
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_organization, create_product

BUYER_EMAIL = "buyer@example.com"
BUYER_NAME = "Test Buyer"
SEAT_RECIPIENT_EMAIL = "teammate@example.com"
BILLING_ADDRESS = {
    "country": "US",
    "city": "San Francisco",
    "postal_code": "94105",
    "line1": "123 Market St",
    "state": "CA",
}

E2E_SEAT_AUTH = pytest.mark.auth(
    AuthSubjectFixture(
        subject="user",
        scopes={
            Scope.web_read,
            Scope.web_write,
            Scope.checkouts_read,
            Scope.checkouts_write,
            Scope.orders_read,
            Scope.customer_seats_read,
            Scope.customer_seats_write,
        },
    )
)


@pytest_asyncio.fixture
async def seat_org(
    save_fixture: SaveFixture, user: User
) -> Organization:
    """Organization with seat-based pricing enabled, linked to the test user."""
    from polar.models import UserOrganization

    org = await create_organization(
        save_fixture,
        feature_settings={"seat_based_pricing_enabled": True},
    )
    await save_fixture(UserOrganization(user=user, organization=org))
    return org


@pytest_asyncio.fixture
async def seat_product(
    save_fixture: SaveFixture, seat_org: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=seat_org,
        recurring_interval=None,
        name="E2E Team Tool (per seat)",
        prices=[("seat", 1000, "usd")],  # $10/seat
    )


@pytest.mark.asyncio
class TestSeatClaim:
    @E2E_SEAT_AUTH
    async def test_assign_and_claim_seat(
        self,
        client: AsyncClient,
        session: AsyncSession,
        stripe_sim: StripeSimulator,
        drain: DrainFn,
        seat_org: Organization,
        seat_product: Product,
    ) -> None:
        """Buy 3 seats → assign one to a teammate → teammate claims it."""

        # ── Purchase 3 seats ─────────────────────────────────────────
        response = await client.post(
            "/v1/checkouts/",
            json={
                "products": [str(seat_product.id)],
                "seats": 3,
            },
        )
        assert response.status_code == 201, response.text
        checkout_id = response.json()["id"]
        client_secret = response.json()["client_secret"]
        # 3 seats * $10 = $30
        assert response.json()["amount"] == 3000

        await drain()

        stripe_sim.expect_payment(
            amount=3000,
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
        await drain()

        await stripe_sim.send_charge_webhook(
            session,
            organization_id=seat_org.id,
            checkout_id=checkout_id,
        )
        await drain()

        # Verify order exists
        response = await client.get("/v1/orders/")
        assert response.status_code == 200
        orders = response.json()
        assert orders["pagination"]["total_count"] == 1
        order_id = orders["items"][0]["id"]

        # ── Assign a seat to a teammate ──────────────────────────────
        response = await client.post(
            "/v1/customer-seats",
            json={
                "order_id": order_id,
                "email": SEAT_RECIPIENT_EMAIL,
            },
        )
        assert response.status_code == 200, response.text
        seat_data = response.json()
        assert seat_data["status"] == "pending"
        seat_id = seat_data["id"]

        await drain()

        # Get the invitation token from the DB (not exposed in API response)
        from polar.customer_seat.repository import CustomerSeatRepository

        seat_repo = CustomerSeatRepository.from_session(session)
        seat_model = await seat_repo.get_by_id(seat_id)
        assert seat_model is not None
        invitation_token = seat_model.invitation_token
        assert invitation_token is not None

        # ── Recipient claims the seat ────────────────────────────────
        response = await client.post(
            "/v1/customer-seats/claim",
            json={"invitation_token": invitation_token},
        )
        # Note: claim endpoint doesn't require auth (anonymous allowed)
        assert response.status_code == 200, response.text
        claim_data = response.json()
        assert claim_data["seat"]["status"] == "claimed"
        assert claim_data["customer_session_token"] is not None

        # Benefits should be enqueued after claim
        executed = await drain()
        assert "benefit.enqueue_benefits_grants" in executed
