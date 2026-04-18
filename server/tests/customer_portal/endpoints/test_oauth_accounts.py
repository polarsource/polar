from urllib.parse import parse_qs, urlparse

import pytest
from httpx import AsyncClient

from polar.config import settings
from polar.kit import jwt
from polar.models import Customer, Organization
from polar.models.customer import CustomerOAuthPlatform
from tests.fixtures.auth import CUSTOMER_AUTH_SUBJECT, MEMBER_AUTH_SUBJECT
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer


def _extract_state(authorization_url: str) -> str:
    parsed = urlparse(authorization_url)
    qs = parse_qs(parsed.query)
    assert "state" in qs, f"state not found in URL: {authorization_url}"
    return qs["state"][0]


_BASE_PARAMS = {
    "platform": CustomerOAuthPlatform.github.value,
    "return_to": "/",
}


@pytest.mark.asyncio
class TestAuthorize:
    async def test_anonymous_with_customer_id_is_rejected(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        victim = await create_customer(
            save_fixture, organization=organization, email="victim@example.com"
        )
        response = await client.get(
            "/v1/customer-portal/oauth-accounts/authorize",
            params={**_BASE_PARAMS, "customer_id": str(victim.id)},
        )
        assert response.status_code == 401

    async def test_anonymous_without_customer_id_is_rejected(
        self, client: AsyncClient
    ) -> None:
        response = await client.get(
            "/v1/customer-portal/oauth-accounts/authorize",
            params=_BASE_PARAMS,
        )
        assert response.status_code == 401

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_customer_cannot_override_customer_id(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        """State JWT must encode the authenticated customer's id, not the query param."""
        other_customer = await create_customer(
            save_fixture, organization=organization, email="other@example.com"
        )
        response = await client.get(
            "/v1/customer-portal/oauth-accounts/authorize",
            params={**_BASE_PARAMS, "customer_id": str(other_customer.id)},
        )
        assert response.status_code == 200

        state = _extract_state(response.json()["url"])
        decoded = jwt.decode(token=state, secret=settings.SECRET, type="customer_oauth")
        assert decoded["customer_id"] == str(customer.id)

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_customer_without_customer_id_succeeds(
        self, client: AsyncClient, customer: Customer
    ) -> None:
        response = await client.get(
            "/v1/customer-portal/oauth-accounts/authorize",
            params=_BASE_PARAMS,
        )
        assert response.status_code == 200
        state = _extract_state(response.json()["url"])
        decoded = jwt.decode(token=state, secret=settings.SECRET, type="customer_oauth")
        assert decoded["customer_id"] == str(customer.id)

    @pytest.mark.auth(MEMBER_AUTH_SUBJECT)
    @pytest.mark.keep_session_state
    async def test_member_cannot_override_customer_id(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """State JWT must encode the member's associated customer_id, not the query param."""
        attacker_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="attacker-target@example.com",
        )
        response = await client.get(
            "/v1/customer-portal/oauth-accounts/authorize",
            params={**_BASE_PARAMS, "customer_id": str(attacker_customer.id)},
        )
        assert response.status_code == 200

        state = _extract_state(response.json()["url"])
        decoded = jwt.decode(token=state, secret=settings.SECRET, type="customer_oauth")
        assert decoded["customer_id"] != str(attacker_customer.id)
        assert "member_id" in decoded
