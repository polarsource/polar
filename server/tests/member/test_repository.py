import pytest

from polar.kit.utils import utc_now
from polar.member.repository import MemberRepository
from polar.models import Member, Organization
from polar.models.member import MemberRole
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer, create_organization


@pytest.mark.asyncio
class TestListByEmailAndOrganization:
    async def test_no_members_returns_empty(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test that no matching members returns empty list."""
        repository = MemberRepository.from_session(session)

        members = await repository.list_by_email_and_organization(
            session,"nonexistent@example.com", organization.id
        )

        assert len(members) == 0

    async def test_single_member_returned(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that single matching member is returned."""
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

        repository = MemberRepository.from_session(session)
        members = await repository.list_by_email_and_organization(
            session,"test@example.com", organization.id
        )

        assert len(members) == 1
        assert members[0].id == member.id
        assert members[0].email == "test@example.com"

    async def test_multiple_members_same_email_returned(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that multiple members with same email are returned."""
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
            name="Member One",
            role=MemberRole.owner,
        )
        member2 = Member(
            customer_id=customer2.id,
            organization_id=organization.id,
            email=shared_email,
            name="Member Two",
            role=MemberRole.member,
        )
        await save_fixture(member1)
        await save_fixture(member2)

        repository = MemberRepository.from_session(session)
        members = await repository.list_by_email_and_organization(
            session,shared_email, organization.id
        )

        assert len(members) == 2
        member_ids = {m.id for m in members}
        assert member1.id in member_ids
        assert member2.id in member_ids

    async def test_case_insensitive_email(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that email matching is case-insensitive."""
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

        repository = MemberRepository.from_session(session)

        # Test uppercase
        members_upper = await repository.list_by_email_and_organization(
            session,"USER@EXAMPLE.COM", organization.id
        )
        assert len(members_upper) == 1
        assert members_upper[0].id == member.id

        # Test mixed case
        members_mixed = await repository.list_by_email_and_organization(
            session,"User@Example.Com", organization.id
        )
        assert len(members_mixed) == 1
        assert members_mixed[0].id == member.id

    async def test_excludes_soft_deleted_members(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that soft-deleted members are excluded."""
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

        repository = MemberRepository.from_session(session)
        members = await repository.list_by_email_and_organization(
            session,"deleted@example.com", organization.id
        )

        assert len(members) == 0

    async def test_filters_by_organization(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that only members from specified organization are returned."""
        # Create member in primary organization
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

        # Create member with same email in different organization
        other_org = await create_organization(save_fixture)
        customer2 = await create_customer(
            save_fixture, organization=other_org, email="customer2@example.com"
        )
        member2 = Member(
            customer_id=customer2.id,
            organization_id=other_org.id,
            email="shared@example.com",
            role=MemberRole.owner,
        )
        await save_fixture(member2)

        repository = MemberRepository.from_session(session)

        # Query primary organization
        members_org1 = await repository.list_by_email_and_organization(
            session,"shared@example.com", organization.id
        )
        assert len(members_org1) == 1
        assert members_org1[0].id == member1.id

        # Query other organization
        members_org2 = await repository.list_by_email_and_organization(
            session,"shared@example.com", other_org.id
        )
        assert len(members_org2) == 1
        assert members_org2[0].id == member2.id

    async def test_eager_loads_customer(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that customer relationship is eagerly loaded."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="test@example.com",
            name="Test Customer",
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="test@example.com",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        repository = MemberRepository.from_session(session)
        members = await repository.list_by_email_and_organization(
            session,"test@example.com", organization.id
        )

        assert len(members) == 1
        # Access customer without additional query (eager loaded)
        assert members[0].customer.id == customer.id
        assert members[0].customer.name == "Test Customer"
