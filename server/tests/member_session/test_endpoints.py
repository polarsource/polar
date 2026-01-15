import uuid

import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import Member, Organization, UserOrganization
from polar.models.member import MemberRole
from polar.models.member_session import MEMBER_SESSION_TOKEN_PREFIX
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer

MEMBER_SESSION_SCOPES = {Scope.web_read, Scope.web_write, Scope.member_sessions_write}


@pytest.mark.asyncio
class TestCreate:
    async def test_anonymous(self, client: AsyncClient) -> None:
        """Anonymous users should not be able to create member sessions."""
        response = await client.post(
            "/v1/member-sessions/", json={"member_id": str(uuid.uuid4())}
        )
        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(subject="user", scopes=MEMBER_SESSION_SCOPES))
    async def test_member_not_found(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        """Should return 422 when member doesn't exist."""
        response = await client.post(
            "/v1/member-sessions/", json={"member_id": str(uuid.uuid4())}
        )
        assert response.status_code == 422

    @pytest.mark.auth(AuthSubjectFixture(subject="user", scopes=MEMBER_SESSION_SCOPES))
    async def test_member_not_accessible(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization_second: Organization,
    ) -> None:
        """Should return 422 when user can't access the member's organization."""
        organization_second.feature_settings = {
            "member_model_enabled": True,
            "seat_based_pricing_enabled": True,
        }
        await save_fixture(organization_second)

        customer = await create_customer(
            save_fixture, organization=organization_second, email="test@example.com"
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization_second.id,
            email=customer.email,
            name="Test Member",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        response = await client.post(
            "/v1/member-sessions/", json={"member_id": str(member.id)}
        )
        assert response.status_code == 422

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user", scopes=MEMBER_SESSION_SCOPES),
        AuthSubjectFixture(subject="organization", scopes=MEMBER_SESSION_SCOPES),
    )
    async def test_valid_member_id(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Should create session successfully with valid member_id."""
        organization.feature_settings = {
            "member_model_enabled": True,
            "seat_based_pricing_enabled": True,
        }
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture, organization=organization, email="test@example.com"
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            name="Test Member",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        response = await client.post(
            "/v1/member-sessions/", json={"member_id": str(member.id)}
        )
        assert response.status_code == 201

        json = response.json()
        assert json["token"].startswith(MEMBER_SESSION_TOKEN_PREFIX)
        assert json["member_id"] == str(member.id)
        assert json["customer_id"] == str(customer.id)
        assert json["token"] in json["member_portal_url"]
        assert "member" in json
        assert "customer" in json

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user", scopes=MEMBER_SESSION_SCOPES),
        AuthSubjectFixture(subject="organization", scopes=MEMBER_SESSION_SCOPES),
    )
    async def test_with_return_url(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Should include return_url in the response."""
        organization.feature_settings = {
            "member_model_enabled": True,
            "seat_based_pricing_enabled": True,
        }
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture, organization=organization, email="test@example.com"
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            name="Test Member",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        response = await client.post(
            "/v1/member-sessions/",
            json={
                "member_id": str(member.id),
                "return_url": "https://example.com/return",
            },
        )
        assert response.status_code == 201

        json = response.json()
        assert json["return_url"] == "https://example.com/return"

    @pytest.mark.auth(AuthSubjectFixture(subject="user", scopes=MEMBER_SESSION_SCOPES))
    async def test_member_model_not_enabled(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Should return 403 when member_model_enabled is false."""
        organization.feature_settings = {
            "member_model_enabled": False,
            "seat_based_pricing_enabled": True,
        }
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture, organization=organization, email="test@example.com"
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            name="Test Member",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        response = await client.post(
            "/v1/member-sessions/", json={"member_id": str(member.id)}
        )
        assert response.status_code == 403
        assert "member_model_enabled" in response.json()["detail"]

    @pytest.mark.auth(AuthSubjectFixture(subject="user", scopes=MEMBER_SESSION_SCOPES))
    async def test_seat_based_pricing_not_enabled(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Should return 403 when seat_based_pricing_enabled is false."""
        organization.feature_settings = {
            "member_model_enabled": True,
            "seat_based_pricing_enabled": False,
        }
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture, organization=organization, email="test@example.com"
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            name="Test Member",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        response = await client.post(
            "/v1/member-sessions/", json={"member_id": str(member.id)}
        )
        assert response.status_code == 403
        assert "seat_based_pricing_enabled" in response.json()["detail"]

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user", scopes=MEMBER_SESSION_SCOPES),
        AuthSubjectFixture(subject="organization", scopes=MEMBER_SESSION_SCOPES),
    )
    async def test_response_includes_nested_member_and_customer(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Should include full member and customer objects in response."""
        organization.feature_settings = {
            "member_model_enabled": True,
            "seat_based_pricing_enabled": True,
        }
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture, organization=organization, email="customer@example.com"
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Test Member",
            role=MemberRole.billing_manager,
        )
        await save_fixture(member)

        response = await client.post(
            "/v1/member-sessions/", json={"member_id": str(member.id)}
        )
        assert response.status_code == 201

        json = response.json()

        # Verify member object
        assert json["member"]["id"] == str(member.id)
        assert json["member"]["email"] == "member@example.com"
        assert json["member"]["name"] == "Test Member"
        assert json["member"]["role"] == "billing_manager"

        # Verify customer object
        assert json["customer"]["id"] == str(customer.id)
        assert json["customer"]["email"] == "customer@example.com"
