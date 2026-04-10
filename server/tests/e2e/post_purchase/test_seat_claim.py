"""
E2E: Post-purchase — seat claiming.

After a seat-based one-time order is paid, the buyer assigns a seat
to a recipient via email. The recipient claims the seat with an
invitation token, which triggers benefit grants.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.kit.db.postgres import AsyncSession
from polar.models import Account, Organization, Product, User, UserOrganization
from tests.e2e.infra import DrainFn, StripeSimulator
from tests.e2e.post_purchase.conftest import E2E_SEAT_AUTH
from tests.e2e.purchase.conftest import complete_purchase
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_organization, create_product

SEAT_RECIPIENT_EMAIL = "teammate@example.com"


@pytest_asyncio.fixture
async def seat_org(
    save_fixture: SaveFixture, user: User, account: Account
) -> Organization:
    """Organization with seat-based pricing enabled, linked to the test user."""
    org = await create_organization(
        save_fixture,
        account,
        feature_settings={"seat_based_pricing_enabled": True},
    )
    await save_fixture(UserOrganization(user=user, organization=org))
    return org


@pytest_asyncio.fixture
async def seat_product(save_fixture: SaveFixture, seat_org: Organization) -> Product:
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
        # Given a completed 3-seat purchase
        result = await complete_purchase(
            client,
            session,
            stripe_sim,
            drain,
            seat_org,
            seat_product,
            amount=3000,
            seats=3,
        )

        # When the buyer assigns a seat to a teammate
        response = await client.post(
            "/v1/customer-seats",
            json={
                "order_id": result.order_id,
                "email": SEAT_RECIPIENT_EMAIL,
            },
        )
        assert response.status_code == 200, response.text
        seat_data = response.json()
        assert seat_data["status"] == "pending"
        seat_id = seat_data["id"]
        await drain()

        # Retrieve invitation token from DB (not exposed in API for security)
        from polar.customer_seat.repository import CustomerSeatRepository

        seat_repo = CustomerSeatRepository.from_session(session)
        seat_model = await seat_repo.get_by_id(seat_id)
        assert seat_model is not None
        invitation_token = seat_model.invitation_token
        assert invitation_token is not None

        # And the teammate claims it
        response = await client.post(
            "/v1/customer-seats/claim",
            json={"invitation_token": invitation_token},
        )
        assert response.status_code == 200, response.text
        claim_data = response.json()

        # Then the seat is claimed
        assert claim_data["seat"]["status"] == "claimed"
        assert claim_data["customer_session_token"] is not None
        await drain()
