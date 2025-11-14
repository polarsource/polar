import uuid

import pytest
from httpx import AsyncClient

from polar.customer_session.service import CUSTOMER_SESSION_TOKEN_PREFIX
from polar.models import Customer, Organization, UserOrganization
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer


@pytest.mark.asyncio
class TestCreate:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/customer-sessions/", json={"customer_id": str(uuid.uuid4())}
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_cant_manage_customer(
        self, client: AsyncClient, customer: Customer
    ) -> None:
        response = await client.post(
            "/v1/customer-sessions/", json={"customer_id": str(customer.id)}
        )
        assert response.status_code == 422

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid_customer_id(
        self,
        client: AsyncClient,
        customer: Customer,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/customer-sessions/", json={"customer_id": str(customer.id)}
        )
        assert response.status_code == 201

        json = response.json()

        assert json["token"].startswith(CUSTOMER_SESSION_TOKEN_PREFIX)
        assert json["customer_id"] == str(customer.id)
        assert json["token"] in json["customer_portal_url"]

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid_external_customer_id(
        self,
        client: AsyncClient,
        customer_external_id: Customer,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/customer-sessions/",
            json={"external_customer_id": customer_external_id.external_id},
        )
        assert response.status_code == 201

        json = response.json()

        assert json["token"].startswith(CUSTOMER_SESSION_TOKEN_PREFIX)
        assert json["customer_id"] == str(customer_external_id.id)
        assert json["token"] in json["customer_portal_url"]

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_return_url(
        self,
        client: AsyncClient,
        customer_external_id: Customer,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/customer-sessions/",
            json={
                "external_customer_id": customer_external_id.external_id,
                "return_url": "https://example.com/return",
            },
        )
        assert response.status_code == 201

        json = response.json()

        assert json["token"].startswith(CUSTOMER_SESSION_TOKEN_PREFIX)
        assert json["customer_id"] == str(customer_external_id.id)
        assert json["token"] in json["customer_portal_url"]
        assert json["return_url"] == "https://example.com/return"

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_email_url_encoding(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="contact+test@example.com",
        )

        response = await client.post(
            "/v1/customer-sessions/", json={"customer_id": str(customer.id)}
        )
        assert response.status_code == 201

        json = response.json()
        portal_url = json["customer_portal_url"]

        # The email should be URL-encoded in the portal URL
        # The + should be encoded as %2B, not left as +
        assert (
            "contact%2Btest%40example.com" in portal_url
            or "contact%2Btest@example.com" in portal_url
        )
        # Ensure it's not incorrectly using the unencoded + sign
        assert "contact+test@example.com" not in portal_url
