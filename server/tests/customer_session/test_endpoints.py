import uuid

import pytest
from httpx import AsyncClient

from polar.customer_session.service import CUSTOMER_SESSION_TOKEN_PREFIX
from polar.models import Customer, Member, Organization, UserOrganization
from polar.models.member import MemberRole
from polar.models.member_session import MEMBER_SESSION_TOKEN_PREFIX
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

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_allows_when_seat_based_pricing_enabled_but_not_migrated(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        # Enable seat-based pricing but NOT member_model_enabled (not fully migrated)
        # Should still allow customer-sessions for backward compatibility
        organization.feature_settings = {
            "seat_based_pricing_enabled": True,
            "member_model_enabled": False,
        }
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="test@example.com",
        )

        response = await client.post(
            "/v1/customer-sessions/", json={"customer_id": str(customer.id)}
        )

        assert response.status_code == 201
        json = response.json()
        assert json["customer_id"] == str(customer.id)

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_creates_member_session_when_member_model_enabled(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        # When member_model_enabled is true, should create MemberSession for owner
        organization.feature_settings = {
            "seat_based_pricing_enabled": True,
            "member_model_enabled": True,
        }
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="test@example.com",
        )

        # Create owner member for the customer
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            name="Owner Member",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        response = await client.post(
            "/v1/customer-sessions/", json={"customer_id": str(customer.id)}
        )

        assert response.status_code == 201
        json = response.json()
        # Should return a member session token, not a customer session token
        assert json["token"].startswith(MEMBER_SESSION_TOKEN_PREFIX)
        assert json["customer_id"] == str(customer.id)
        assert json["token"] in json["customer_portal_url"]

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_fails_when_member_model_enabled_but_no_owner(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        # When member_model_enabled but no owner member exists, should return 422
        organization.feature_settings = {
            "seat_based_pricing_enabled": True,
            "member_model_enabled": True,
        }
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="test@example.com",
        )

        # No member created - should fail
        response = await client.post(
            "/v1/customer-sessions/", json={"customer_id": str(customer.id)}
        )

        assert response.status_code == 422
        json = response.json()
        assert "No owner member found" in json["detail"][0]["msg"]
