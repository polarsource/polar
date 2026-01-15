import uuid

import pytest

from polar.customer_portal.service.customer_session import (
    CustomerDoesNotExist,
    CustomerSelectionRequired,
    OrganizationDoesNotExist,
)
from polar.customer_portal.service.customer_session import (
    customer_session as customer_session_service,
)
from polar.models import Member, Organization
from polar.models.member import MemberRole
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer, create_organization


@pytest.mark.asyncio
class TestRequest:
    async def test_organization_does_not_exist(
        self,
        session: AsyncSession,
    ) -> None:
        """Test that non-existent organization raises OrganizationDoesNotExist."""
        fake_org_id = uuid.uuid4()

        with pytest.raises(OrganizationDoesNotExist) as exc_info:
            await customer_session_service.request(
                session, "test@example.com", fake_org_id
            )

        assert exc_info.value.organization_id == fake_org_id


@pytest.mark.asyncio
class TestRequestLegacyOrg:
    """Tests for orgs with member_model_enabled=false (legacy customer lookup)."""

    async def test_customer_exists_returns_code(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that existing customer returns session code (legacy path)."""
        # organization defaults to member_model_enabled=false
        customer = await create_customer(
            save_fixture, organization=organization, email="test@example.com"
        )

        customer_session_code, code = await customer_session_service.request(
            session, "test@example.com", organization.id
        )

        assert customer_session_code.customer.id == customer.id
        assert customer_session_code.email == "test@example.com"
        assert code is not None
        assert len(code) == 6  # Default code length

    async def test_customer_does_not_exist_raises(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that non-existent email raises CustomerDoesNotExist (legacy path)."""
        with pytest.raises(CustomerDoesNotExist) as exc_info:
            await customer_session_service.request(
                session, "nonexistent@example.com", organization.id
            )

        assert exc_info.value.email == "nonexistent@example.com"
        assert exc_info.value.organization == organization

    async def test_case_insensitive_email(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that email matching is case-insensitive (legacy path)."""
        customer = await create_customer(
            save_fixture, organization=organization, email="user@example.com"
        )

        # Try with uppercase email
        customer_session_code, code = await customer_session_service.request(
            session, "USER@EXAMPLE.COM", organization.id
        )

        assert customer_session_code.customer.id == customer.id

    async def test_customer_id_parameter_ignored(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that customer_id is ignored in legacy path (looks up by email only)."""
        customer = await create_customer(
            save_fixture, organization=organization, email="test@example.com"
        )

        # Pass a random customer_id - should be ignored in legacy path
        customer_session_code, code = await customer_session_service.request(
            session, "test@example.com", organization.id, customer_id=uuid.uuid4()
        )

        # Should still work because legacy path uses email lookup only
        assert customer_session_code.customer.id == customer.id


@pytest.mark.asyncio
class TestRequestMemberEnabledOrg:
    """Tests for orgs with member_model_enabled=true (member-based lookup)."""

    async def test_no_members_found(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that non-existent email raises CustomerDoesNotExist."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        with pytest.raises(CustomerDoesNotExist) as exc_info:
            await customer_session_service.request(
                session, "nonexistent@example.com", organization.id
            )

        assert exc_info.value.email == "nonexistent@example.com"
        assert exc_info.value.organization == organization

    async def test_single_member_returns_code(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that single member returns customer session code."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture, organization=organization, email="single@example.com"
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="single@example.com",
            name="Single Member",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        customer_session_code, code = await customer_session_service.request(
            session, "single@example.com", organization.id
        )

        # Access customer via relationship (customer_id not set until flush)
        assert customer_session_code.customer.id == customer.id
        assert customer_session_code.email == "single@example.com"
        assert code is not None
        assert len(code) == 6  # Default code length

    async def test_single_member_case_insensitive_email(
        self,
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
            name="User",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        # Try with uppercase email
        customer_session_code, code = await customer_session_service.request(
            session, "USER@EXAMPLE.COM", organization.id
        )

        assert customer_session_code.customer.id == customer.id

        # Try with mixed case email
        customer_session_code2, code2 = await customer_session_service.request(
            session, "User@Example.Com", organization.id
        )

        assert customer_session_code2.customer.id == customer.id

    async def test_multiple_members_no_customer_id_raises_selection_required(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that multiple members without customer_id raises CustomerSelectionRequired."""
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

        # Create members with the SAME email for different customers
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

        with pytest.raises(CustomerSelectionRequired) as exc_info:
            await customer_session_service.request(
                session, shared_email, organization.id
            )

        assert len(exc_info.value.customers) == 2
        customer_ids = {c.id for c in exc_info.value.customers}
        assert customer1.id in customer_ids
        assert customer2.id in customer_ids

        # Verify customer names are included
        customer_names = {c.name for c in exc_info.value.customers}
        assert "Customer One" in customer_names
        assert "Customer Two" in customer_names

    async def test_multiple_members_with_valid_customer_id_returns_code(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that multiple members with valid customer_id returns code."""
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

        # Select customer1
        customer_session_code, code = await customer_session_service.request(
            session, shared_email, organization.id, customer_id=customer1.id
        )

        assert customer_session_code.customer.id == customer1.id
        assert customer_session_code.email == shared_email

        # Select customer2
        customer_session_code2, code2 = await customer_session_service.request(
            session, shared_email, organization.id, customer_id=customer2.id
        )

        assert customer_session_code2.customer.id == customer2.id

    async def test_multiple_members_with_invalid_customer_id_raises_does_not_exist(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that multiple members with invalid customer_id raises CustomerDoesNotExist."""
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

        # Try with a non-existent customer ID
        fake_customer_id = uuid.uuid4()

        with pytest.raises(CustomerDoesNotExist):
            await customer_session_service.request(
                session, shared_email, organization.id, customer_id=fake_customer_id
            )

    async def test_customer_id_for_different_org_raises_does_not_exist(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that customer_id from different org raises CustomerDoesNotExist."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        # Create customer in the primary organization
        customer1 = await create_customer(
            save_fixture, organization=organization, email="customer1@example.com"
        )
        member1 = Member(
            customer_id=customer1.id,
            organization_id=organization.id,
            email="shared@example.com",
            role=MemberRole.owner,
        )
        await save_fixture(member1)

        # Create another organization with its own customer
        other_org = await create_organization(save_fixture)
        other_customer = await create_customer(
            save_fixture, organization=other_org, email="other@example.com"
        )

        # Try to use customer from other org
        with pytest.raises(CustomerDoesNotExist):
            await customer_session_service.request(
                session,
                "shared@example.com",
                organization.id,
                customer_id=other_customer.id,
            )

    async def test_soft_deleted_member_not_found(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that soft-deleted members are not found."""
        from polar.kit.utils import utc_now

        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture, organization=organization, email="deleted@example.com"
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="deleted@example.com",
            role=MemberRole.owner,
            deleted_at=utc_now(),  # Soft-deleted
        )
        await save_fixture(member)

        with pytest.raises(CustomerDoesNotExist):
            await customer_session_service.request(
                session, "deleted@example.com", organization.id
            )

    async def test_member_email_different_from_customer_email(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that member email is used (not customer email)."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture, organization=organization, email="customer@example.com"
        )
        # Member has different email than customer
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        # Request with member email should work
        customer_session_code, code = await customer_session_service.request(
            session, "member@example.com", organization.id
        )

        assert customer_session_code.customer.id == customer.id
        # The code should be stored with the member's email
        assert customer_session_code.email == "member@example.com"

        # Request with customer email should NOT work (member has different email)
        with pytest.raises(CustomerDoesNotExist):
            await customer_session_service.request(
                session, "customer@example.com", organization.id
            )
