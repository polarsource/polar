import uuid
from unittest.mock import MagicMock

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.models import Member, Organization
from polar.models.member import MemberRole
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer


@pytest.fixture(autouse=True)
def mock_send_email(mocker: MockerFixture) -> MagicMock:
    """Mock the customer session service send method to prevent actual email sending."""
    return mocker.patch(
        "polar.customer_portal.endpoints.customer_session.customer_session_service.send",
        autospec=True,
    )


@pytest.mark.asyncio
class TestRequest:
    async def test_invalid_organization_returns_202(
        self,
        client: AsyncClient,
    ) -> None:
        """Test that invalid organization returns 202 (no information leak)."""
        response = await client.post(
            "/v1/customer-portal/customer-session/request",
            json={
                "email": "test@example.com",
                "organization_id": str(uuid.uuid4()),
            },
        )
        # Returns 202 to prevent organization enumeration
        assert response.status_code == 202


@pytest.mark.asyncio
class TestRequestLegacyOrg:
    """Tests for orgs with member_model_enabled=false (legacy customer lookup)."""

    async def test_customer_exists_returns_202(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that existing customer returns 202 (legacy path)."""
        # organization defaults to member_model_enabled=false
        await create_customer(
            save_fixture, organization=organization, email="test@example.com"
        )

        response = await client.post(
            "/v1/customer-portal/customer-session/request",
            json={
                "email": "test@example.com",
                "organization_id": str(organization.id),
            },
        )
        assert response.status_code == 202

    async def test_customer_does_not_exist_returns_202(
        self,
        client: AsyncClient,
        organization: Organization,
    ) -> None:
        """Test that non-existent email returns 202 (no information leak, legacy path)."""
        response = await client.post(
            "/v1/customer-portal/customer-session/request",
            json={
                "email": "nonexistent@example.com",
                "organization_id": str(organization.id),
            },
        )
        # Returns 202 to prevent email enumeration
        assert response.status_code == 202

    async def test_case_insensitive_email(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that email matching is case-insensitive (legacy path)."""
        await create_customer(
            save_fixture, organization=organization, email="user@example.com"
        )

        # Test uppercase
        response = await client.post(
            "/v1/customer-portal/customer-session/request",
            json={
                "email": "USER@EXAMPLE.COM",
                "organization_id": str(organization.id),
            },
        )
        assert response.status_code == 202


@pytest.mark.asyncio
class TestRequestMemberEnabledOrg:
    """Tests for orgs with member_model_enabled=true (member-based lookup)."""

    async def test_no_members_returns_202(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that non-existent email returns 202 (no information leak)."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        response = await client.post(
            "/v1/customer-portal/customer-session/request",
            json={
                "email": "nonexistent@example.com",
                "organization_id": str(organization.id),
            },
        )
        # Returns 202 to prevent email enumeration
        assert response.status_code == 202

    async def test_single_member_returns_202(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that single member match returns 202 and sends code."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture, organization=organization, email="test@example.com"
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="test@example.com",
            name="Test User",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        response = await client.post(
            "/v1/customer-portal/customer-session/request",
            json={
                "email": "test@example.com",
                "organization_id": str(organization.id),
            },
        )
        assert response.status_code == 202

    async def test_multiple_members_returns_409_with_customer_list(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that multiple member match returns 409 with customer selection."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        customer1 = await create_customer(
            save_fixture,
            organization=organization,
            email="customer1@example.com",
            name="Customer One",
        )
        customer2 = await create_customer(
            save_fixture,
            organization=organization,
            email="customer2@example.com",
            name="Customer Two",
        )

        shared_email = "shared@example.com"
        member1 = Member(
            customer_id=customer1.id,
            organization_id=organization.id,
            email=shared_email,
            name="Member One",
            role=MemberRole.owner,
        )
        member2 = Member(
            customer_id=customer2.id,
            organization_id=organization.id,
            email=shared_email,
            name="Member Two",
            role=MemberRole.owner,
        )
        await save_fixture(member1)
        await save_fixture(member2)

        response = await client.post(
            "/v1/customer-portal/customer-session/request",
            json={
                "email": shared_email,
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 409
        data = response.json()
        assert data["error"] == "customer_selection_required"
        assert (
            data["detail"]
            == "Multiple customers found for this email. Please select one."
        )
        assert len(data["customers"]) == 2

        # Verify customer info
        customer_ids = {c["id"] for c in data["customers"]}
        assert str(customer1.id) in customer_ids
        assert str(customer2.id) in customer_ids

        customer_names = {c["name"] for c in data["customers"]}
        assert "Customer One" in customer_names
        assert "Customer Two" in customer_names

    async def test_multiple_members_with_valid_customer_id_returns_202(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that selecting a customer from multiple returns 202."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        customer1 = await create_customer(
            save_fixture,
            organization=organization,
            email="customer1@example.com",
            name="Customer One",
        )
        customer2 = await create_customer(
            save_fixture,
            organization=organization,
            email="customer2@example.com",
            name="Customer Two",
        )

        shared_email = "shared@example.com"
        member1 = Member(
            customer_id=customer1.id,
            organization_id=organization.id,
            email=shared_email,
            role=MemberRole.owner,
        )
        member2 = Member(
            customer_id=customer2.id,
            organization_id=organization.id,
            email=shared_email,
            role=MemberRole.owner,
        )
        await save_fixture(member1)
        await save_fixture(member2)

        # Select customer1
        response = await client.post(
            "/v1/customer-portal/customer-session/request",
            json={
                "email": shared_email,
                "organization_id": str(organization.id),
                "customer_id": str(customer1.id),
            },
        )
        assert response.status_code == 202

        # Select customer2
        response2 = await client.post(
            "/v1/customer-portal/customer-session/request",
            json={
                "email": shared_email,
                "organization_id": str(organization.id),
                "customer_id": str(customer2.id),
            },
        )
        assert response2.status_code == 202

    async def test_multiple_members_with_invalid_customer_id_returns_202(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that invalid customer_id returns 202 (no information leak)."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        customer1 = await create_customer(
            save_fixture, organization=organization, email="customer1@example.com"
        )
        customer2 = await create_customer(
            save_fixture, organization=organization, email="customer2@example.com"
        )

        shared_email = "shared@example.com"
        member1 = Member(
            customer_id=customer1.id,
            organization_id=organization.id,
            email=shared_email,
            role=MemberRole.owner,
        )
        member2 = Member(
            customer_id=customer2.id,
            organization_id=organization.id,
            email=shared_email,
            role=MemberRole.owner,
        )
        await save_fixture(member1)
        await save_fixture(member2)

        # Use invalid customer_id
        response = await client.post(
            "/v1/customer-portal/customer-session/request",
            json={
                "email": shared_email,
                "organization_id": str(organization.id),
                "customer_id": str(uuid.uuid4()),
            },
        )
        # Returns 202 to prevent customer_id enumeration
        assert response.status_code == 202

    async def test_case_insensitive_email(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that email matching is case-insensitive."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture, organization=organization, email="user@example.com"
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="user@example.com",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        # Test uppercase
        response = await client.post(
            "/v1/customer-portal/customer-session/request",
            json={
                "email": "USER@EXAMPLE.COM",
                "organization_id": str(organization.id),
            },
        )
        assert response.status_code == 202

        # Test mixed case
        response2 = await client.post(
            "/v1/customer-portal/customer-session/request",
            json={
                "email": "User@Example.Com",
                "organization_id": str(organization.id),
            },
        )
        assert response2.status_code == 202

    async def test_customer_with_null_name(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test 409 response includes customers with null names."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        customer1 = await create_customer(
            save_fixture, organization=organization, email="customer1@example.com"
        )
        # Set name to None
        customer1.name = None
        await save_fixture(customer1)

        customer2 = await create_customer(
            save_fixture,
            organization=organization,
            email="customer2@example.com",
            name="Has Name",
        )

        shared_email = "shared@example.com"
        member1 = Member(
            customer_id=customer1.id,
            organization_id=organization.id,
            email=shared_email,
            role=MemberRole.owner,
        )
        member2 = Member(
            customer_id=customer2.id,
            organization_id=organization.id,
            email=shared_email,
            role=MemberRole.owner,
        )
        await save_fixture(member1)
        await save_fixture(member2)

        response = await client.post(
            "/v1/customer-portal/customer-session/request",
            json={
                "email": shared_email,
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 409
        data = response.json()
        assert len(data["customers"]) == 2

        # Verify one has null name
        names = [c["name"] for c in data["customers"]]
        assert None in names
        assert "Has Name" in names
