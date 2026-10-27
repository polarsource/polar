import uuid

import pytest
from sqlalchemy import select

from polar.customer_portal.service.customer_session import (
    CustomerDoesNotExist,
    CustomerSelectionRequired,
)
from polar.customer_portal.service.customer_session import (
    customer_session as customer_session_service,
)
from polar.kit.utils import utc_now
from polar.models import (
    Account,
    Member,
    Organization,
    User,
)
from polar.models.member import MemberRole
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_account,
    create_customer,
    create_organization,
)


@pytest.mark.anyio
class TestGetMemberLegacyOrg:
    """Tests for orgs with member_model_enabled=false (legacy customer lookup)."""

    async def test_customer_exists_returns_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that existing customer returns its member (legacy path)."""
        # organization defaults to member_model_enabled=false
        customer = await create_customer(
            save_fixture, organization=organization, email="test@example.com"
        )

        member = await customer_session_service.get_member(
            session, "test@example.com", organization, None
        )

        assert member.customer.id == customer.id
        assert member.email == "test@example.com"

    async def test_customer_does_not_exist_raises(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that non-existent email raises CustomerDoesNotExist (legacy path)."""
        with pytest.raises(CustomerDoesNotExist) as exc_info:
            await customer_session_service.get_member(
                session, "nonexistent@example.com", organization, None
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
        member = await customer_session_service.get_member(
            session, "USER@EXAMPLE.COM", organization, None
        )

        assert member.customer.id == customer.id

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
            await customer_session_service.get_member(
                session, "nonexistent@example.com", organization, None
            )

        assert exc_info.value.email == "nonexistent@example.com"
        assert exc_info.value.organization == organization

    async def test_single_member_returns_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that single member returns its member."""
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

        member = await customer_session_service.get_member(
            session, "single@example.com", organization, None
        )

        # Access customer via relationship (customer_id not set until flush)
        assert member.customer.id == customer.id
        assert member.email == "single@example.com"

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
        member = await customer_session_service.get_member(
            session, "USER@EXAMPLE.COM", organization, None
        )

        assert member.customer.id == customer.id

        # Try with mixed case email
        member2 = await customer_session_service.get_member(
            session, "User@Example.Com", organization, None
        )

        assert member2.customer.id == customer.id

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
            await customer_session_service.get_member(
                session, shared_email, organization, None
            )

        assert len(exc_info.value.customers) == 2
        customer_ids = {c.id for c in exc_info.value.customers}
        assert customer1.id in customer_ids
        assert customer2.id in customer_ids

        # Verify customer names are included
        customer_names = {c.name for c in exc_info.value.customers}
        assert "Customer One" in customer_names
        assert "Customer Two" in customer_names

    async def test_multiple_members_with_valid_customer_id_returns_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that multiple members with valid customer_id returns the selected member."""
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
        member = await customer_session_service.get_member(
            session, shared_email, organization, customer_id=customer1.id
        )

        assert member.customer.id == customer1.id
        assert member.email == shared_email

        # Select customer2
        member2 = await customer_session_service.get_member(
            session, shared_email, organization, customer_id=customer2.id
        )

        assert member2.customer.id == customer2.id

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
            await customer_session_service.get_member(
                session, shared_email, organization, customer_id=fake_customer_id
            )

    async def test_customer_id_for_different_org_raises_does_not_exist(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        account: Account,
        user: User,
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
        other_account = await create_account(save_fixture, user)
        other_org = await create_organization(save_fixture, other_account)
        other_customer = await create_customer(
            save_fixture, organization=other_org, email="other@example.com"
        )

        # Try to use customer from other org
        with pytest.raises(CustomerDoesNotExist):
            await customer_session_service.get_member(
                session,
                "shared@example.com",
                organization,
                customer_id=other_customer.id,
            )

    async def test_soft_deleted_member_auto_creates_new_owner(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that soft-deleted members trigger auto-creation of a new owner member."""

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

        # Graceful fallback: auto-creates a new owner member since customer exists
        member = await customer_session_service.get_member(
            session, "deleted@example.com", organization, None
        )
        assert member is not None

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
        member = await customer_session_service.get_member(
            session, "member@example.com", organization, None
        )

        assert member.customer.id == customer.id
        # The code should be stored with the member's email
        assert member.email == "member@example.com"

        # Request with customer email should now auto-create an owner member
        # (graceful fallback finds the customer and creates a new owner member)
        member2 = await customer_session_service.get_member(
            session, "customer@example.com", organization, None
        )
        assert member2 is not None
        assert member2.customer.id == customer.id


@pytest.mark.anyio
class TestGetMemberMemberEnabledOrgGracefulFallback:
    """Tests for the graceful fallback: auto-create owner member for existing customers."""

    async def test_auto_creates_owner_member_for_existing_customer(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """When member_model enabled but customer has no member, auto-create one."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture, organization=organization, email="existing@example.com"
        )

        # No member created manually — the fallback should create it
        member = await customer_session_service.get_member(
            session, "existing@example.com", organization, None
        )

        assert member is not None
        # Verify an owner member was created

        stmt = select(Member).where(
            Member.customer_id == customer.id,
            Member.role == MemberRole.owner,
            Member.deleted_at.is_(None),
        )
        result = await session.execute(stmt)
        members = result.scalars().all()
        assert len(members) == 1
        assert members[0].email == "existing@example.com"

    async def test_still_raises_when_no_customer_exists(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """When no customer exists for the email, should still raise."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        with pytest.raises(CustomerDoesNotExist):
            await customer_session_service.get_member(
                session, "nobody@example.com", organization, None
            )
