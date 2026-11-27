"""
E2E: Post-purchase — seat claiming.

After a seat-based one-time order is paid, the buyer assigns a seat
to a recipient via email. The recipient claims the seat with an
invitation token, which triggers benefit grants.
"""

import re

import pytest
from httpx2 import AsyncClient
from pytest_mock import MockerFixture

from polar.kit.db.postgres import AsyncSession
from polar.models import Organization, Product, User, UserOrganization
from tests.e2e.infra import DrainFn, EmailCapture, StripeSimulator
from tests.e2e.post_purchase.conftest import E2E_SEAT_AUTH
from tests.e2e.purchase.conftest import complete_purchase
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_account,
    create_organization,
    create_product,
)

SEAT_RECIPIENT_EMAIL = "teammate@example.com"


@pytest.fixture
async def seat_org(save_fixture: SaveFixture, user: User) -> Organization:
    """Organization with seat-based pricing enabled, linked to the test user."""
    account = await create_account(save_fixture, user)
    org = await create_organization(
        save_fixture,
        account,
    )
    await save_fixture(UserOrganization(user=user, organization=org))
    return org


@pytest.fixture
async def seat_product(save_fixture: SaveFixture, seat_org: Organization) -> Product:
    return await create_product(
        save_fixture,
        organization=seat_org,
        recurring_interval=None,
        name="E2E Team Tool (per seat)",
        prices=[("seat", 1000, "usd")],  # $10/seat
    )


@pytest.mark.anyio
class TestSeatClaim:
    @E2E_SEAT_AUTH
    async def test_assign_and_claim_seat(
        self,
        client: AsyncClient,
        session: AsyncSession,
        stripe_sim: StripeSimulator,
        drain: DrainFn,
        email_capture: EmailCapture,
        mocker: MockerFixture,
        seat_org: Organization,
        seat_product: Product,
    ) -> None:
        mocker.patch(
            "polar.email.tasks.render_from_json",
            side_effect=lambda template, props_json: props_json,
        )
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

        # Retrieve the invitation token from the email props (only its hash is stored)
        [invitation_email] = email_capture.find(to=SEAT_RECIPIENT_EMAIL)
        match = re.search(r"portal/claim\?token=(\w+)", invitation_email.html_content)
        assert match is not None
        invitation_token = match.group(1)

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
