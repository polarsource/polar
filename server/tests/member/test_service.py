from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.exc import IntegrityError

from polar.auth.models import AuthSubject
from polar.enums import SubscriptionRecurringInterval
from polar.exceptions import NotPermitted, PolarRequestValidationError
from polar.kit.pagination import PaginationParams
from polar.member.repository import MemberRepository
from polar.member.service import member_service
from polar.models import (
    Customer,
    CustomerSeat,
    Member,
    Organization,
    User,
    UserOrganization,
)
from polar.models.customer import CustomerType
from polar.models.customer_seat import SeatStatus
from polar.models.member import MemberRole
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_account,
    create_customer,
    create_member,
    create_organization,
    create_product,
    create_subscription_with_seats,
)


@pytest.mark.asyncio
class TestGetByExternalID:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_valid(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )

        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Test Member",
            external_id="ext_svc_123",
            role=MemberRole.member,
        )
        await save_fixture(member)

        result = await member_service.get_by_external_id(
            session, auth_subject, "ext_svc_123"
        )

        assert result is not None
        assert result.id == member.id
        assert result.external_id == "ext_svc_123"

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_not_existing(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
    ) -> None:
        result = await member_service.get_by_external_id(
            session, auth_subject, "nonexistent"
        )

        assert result is None

    @pytest.mark.auth
    async def test_not_accessible_organization(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user: User,
    ) -> None:
        other_account = await create_account(save_fixture, user)
        other_org = await create_organization(save_fixture, other_account)
        customer = await create_customer(
            save_fixture,
            organization=other_org,
            email="customer@example.com",
        )

        member = Member(
            customer_id=customer.id,
            organization_id=other_org.id,
            email="member@example.com",
            external_id="ext_other_org",
            role=MemberRole.member,
        )
        await save_fixture(member)

        result = await member_service.get_by_external_id(
            session, auth_subject, "ext_other_org"
        )

        assert result is None


@pytest.mark.asyncio
class TestList:
    @pytest.mark.auth
    async def test_not_accessible_organization(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        user: User,
    ) -> None:
        """Test that user cannot access members from organizations they don't belong to."""
        other_account = await create_account(save_fixture, user)
        other_org = await create_organization(save_fixture, other_account)
        customer = await create_customer(
            save_fixture,
            organization=other_org,
            email="customer@example.com",
        )

        # Create a member
        member = Member(
            customer_id=customer.id,
            organization_id=other_org.id,
            email="member@example.com",
            name="Member",
            role=MemberRole.member,
        )
        await save_fixture(member)

        members, total = await member_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )
        assert len(members) == 0
        assert total == 0

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_filter_by_customer_id(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Test filtering members by customer_id."""
        customer1 = await create_customer(
            save_fixture,
            organization=organization,
            email="customer1@example.com",
        )
        customer2 = await create_customer(
            save_fixture,
            organization=organization,
            email="customer2@example.com",
        )

        # Create members for customer1
        member1 = Member(
            customer_id=customer1.id,
            organization_id=organization.id,
            email="member1@example.com",
            name="Member 1",
            role=MemberRole.owner,
        )
        await save_fixture(member1)

        # Create members for customer2
        member2 = Member(
            customer_id=customer2.id,
            organization_id=organization.id,
            email="member2@example.com",
            name="Member 2",
            role=MemberRole.member,
        )
        await save_fixture(member2)

        # Filter by customer1 ID
        members, total = await member_service.list(
            session,
            auth_subject,
            customer_id=customer1.id,
            pagination=PaginationParams(1, 10),
        )

        assert len(members) == 1
        assert total == 1
        assert member1 in members

        # Filter by customer2 ID
        members, total = await member_service.list(
            session,
            auth_subject,
            customer_id=customer2.id,
            pagination=PaginationParams(1, 10),
        )

        assert len(members) == 1
        assert total == 1
        assert member2 in members

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_pagination(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Test pagination of members."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )

        # Create 5 members with unique external_ids
        for i in range(5):
            member = Member(
                customer_id=customer.id,
                organization_id=organization.id,
                email=f"member{i}@example.com",
                name=f"Member {i}",
                external_id=f"ext_{i}",
                role=MemberRole.member,
            )
            await save_fixture(member)

        # Get first page
        members, total = await member_service.list(
            session,
            auth_subject,
            pagination=PaginationParams(1, 2),
        )

        assert len(members) == 2
        assert total == 5

        # Get second page
        members, total = await member_service.list(
            session,
            auth_subject,
            pagination=PaginationParams(2, 2),
        )

        assert len(members) == 2
        assert total == 5


@pytest.mark.asyncio
class TestCreateOwnerMember:
    async def test_feature_flag_disabled(
        self,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        """Test that member is not created when feature flag is disabled."""
        organization.feature_settings = {"member_model_enabled": False}

        member = await member_service.create_owner_member(
            session, customer, organization
        )

        # Should return None when feature flag is disabled
        assert member is None

    async def test_feature_flag_enabled_creates_member(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test that owner member is created when feature flag is enabled."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="test@example.com",
            name="Test User",
            external_id="test_123",
        )

        member = await member_service.create_owner_member(
            session, customer, organization
        )

        assert member is not None
        assert member.customer_id == customer.id
        assert member.email == customer.email
        assert member.name == customer.name
        assert member.external_id == customer.external_id
        assert member.role == MemberRole.owner

    async def test_idempotency(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test that creating member twice with same email is idempotent."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="test@example.com",
            name="Test User",
        )

        member1 = await member_service.create_owner_member(
            session, customer, organization
        )
        assert member1 is not None

        member2 = await member_service.create_owner_member(
            session, customer, organization
        )

        assert member2 is not None
        assert member2.id == member1.id

    async def test_member_without_name(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test that member can be created when customer has no name."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="noname@example.com",
        )
        # Set name to None after creation
        customer.name = None
        await save_fixture(customer)

        member = await member_service.create_owner_member(
            session, customer, organization
        )

        assert member is not None
        assert member.name is None
        assert member.email == customer.email

    async def test_member_without_external_id(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test that member can be created when customer has no external_id."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="noexternal@example.com",
            external_id=None,
        )

        member = await member_service.create_owner_member(
            session, customer, organization
        )

        assert member is not None
        assert member.external_id is None
        assert member.email == customer.email

    async def test_reuses_existing_owner_when_customer_email_drifted(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """When owner.email has drifted from customer.email, auto-create must
        reuse the existing owner rather than insert a second row."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="correct@example.com",
        )
        existing = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="drifted@example.com",
            role=MemberRole.owner,
        )
        await save_fixture(existing)

        member = await member_service.create_owner_member(
            session, customer, organization
        )

        assert member is not None
        assert member.id == existing.id
        repository = MemberRepository.from_session(session)
        members = await repository.list_by_customer(customer.id)
        assert len([m for m in members if m.role == MemberRole.owner]) == 1


@pytest.mark.asyncio
class TestCreate:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_individual_customer_cannot_have_multiple_members(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Test that individual customers can only have 1 member (the owner)."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="individual@example.com",
        )
        customer.type = CustomerType.individual
        await save_fixture(customer)

        # Create the first member (owner)
        owner = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="owner@example.com",
            name="Owner",
            role=MemberRole.owner,
        )
        await save_fixture(owner)

        # Trying to add a second member should fail
        with pytest.raises(NotPermitted) as exc_info:
            await member_service.create(
                session,
                auth_subject,
                customer_id=customer.id,
                email="second@example.com",
                name="Second Member",
                role=MemberRole.member,
            )

        assert "individual" in str(exc_info.value).lower()
        assert "one member" in str(exc_info.value).lower()

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_team_customer_can_have_multiple_members(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Test that team customers can have multiple members."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="team@example.com",
        )
        customer.type = CustomerType.team
        await save_fixture(customer)

        # Create the first member (owner)
        owner = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="owner@example.com",
            name="Owner",
            role=MemberRole.owner,
        )
        await save_fixture(owner)

        # Adding a second member should succeed for team customers
        second_member = await member_service.create(
            session,
            auth_subject,
            customer_id=customer.id,
            email="second@example.com",
            name="Second Member",
            role=MemberRole.member,
        )

        assert second_member is not None
        assert second_member.email == "second@example.com"
        assert second_member.role == MemberRole.member


@pytest.mark.asyncio
class TestUpdate:
    @pytest.mark.auth
    async def test_update_name(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test updating member name."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )

        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Original Name",
            role=MemberRole.member,
        )
        await save_fixture(member)

        updated_member = await member_service.update(
            session, member, name="Updated Name"
        )

        assert updated_member.id == member.id
        assert updated_member.name == "Updated Name"
        assert updated_member.email == "member@example.com"
        assert updated_member.role == MemberRole.member

    @pytest.mark.auth
    async def test_update_role(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test updating member role."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )

        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Test Member",
            role=MemberRole.member,
        )
        await save_fixture(member)

        updated_member = await member_service.update(
            session, member, role=MemberRole.billing_manager
        )

        assert updated_member.id == member.id
        assert updated_member.role == MemberRole.billing_manager

    @pytest.mark.auth
    async def test_update_multiple_fields(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test updating multiple member fields at once."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )

        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Original Name",
            external_id="ext_123",
            role=MemberRole.member,
        )
        await save_fixture(member)

        updated_member = await member_service.update(
            session,
            member,
            name="Updated Name",
            role=MemberRole.billing_manager,
        )

        assert updated_member.id == member.id
        assert updated_member.name == "Updated Name"
        assert updated_member.role == MemberRole.billing_manager

    @pytest.mark.auth
    async def test_update_cannot_remove_last_owner(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test that cannot change role when member is the only owner."""
        from polar.exceptions import PolarRequestValidationError

        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )

        owner = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="owner@example.com",
            name="Owner",
            role=MemberRole.owner,
        )
        await save_fixture(owner)

        with pytest.raises(PolarRequestValidationError) as exc_info:
            await member_service.update(session, owner, role=MemberRole.member)

        assert "must have exactly one owner" in str(exc_info.value).lower()

    @pytest.mark.auth
    async def test_update_cannot_promote_to_owner_when_owner_exists(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test that cannot promote member to owner when an owner already exists."""
        from polar.exceptions import PolarRequestValidationError

        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )

        owner = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="owner@example.com",
            name="Owner",
            role=MemberRole.owner,
        )
        await save_fixture(owner)

        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Member",
            role=MemberRole.member,
        )
        await save_fixture(member)

        with pytest.raises(PolarRequestValidationError) as exc_info:
            await member_service.update(session, member, role=MemberRole.owner)

        assert "only the owner can transfer ownership" in str(exc_info.value).lower()

    @pytest.mark.auth
    async def test_update_ownership_transfer_customer_portal(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Regression: the partial unique index on (customer_id) WHERE role='owner'
        would trip if demote+promote ran as two separate UPDATEs."""
        customer = await create_customer(
            save_fixture, organization=organization, email="customer@example.com"
        )
        owner = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            role=MemberRole.owner,
            email="owner@example.com",
        )
        member = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            role=MemberRole.member,
            email="member@example.com",
        )

        updated = await member_service.update(
            session, member, role=MemberRole.owner, caller_member=owner
        )

        assert updated.role == MemberRole.owner

        await session.refresh(owner)
        await session.refresh(member)
        assert owner.role == MemberRole.billing_manager
        assert member.role == MemberRole.owner

    @pytest.mark.auth
    async def test_update_ownership_transfer_admin(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, email="customer@example.com"
        )
        owner = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            role=MemberRole.owner,
            email="owner@example.com",
        )
        member = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            role=MemberRole.member,
            email="member@example.com",
        )

        updated = await member_service.update(
            session, member, role=MemberRole.owner, allow_ownership_transfer=True
        )

        assert updated.role == MemberRole.owner

        await session.refresh(owner)
        await session.refresh(member)
        assert owner.role == MemberRole.billing_manager
        assert member.role == MemberRole.owner

    @pytest.mark.auth
    async def test_update_no_changes(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test that updating with no changes returns the same member."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )

        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Test Member",
            role=MemberRole.member,
        )
        await save_fixture(member)

        original_updated_at = member.modified_at

        updated_member = await member_service.update(session, member)

        assert updated_member.id == member.id
        assert updated_member.modified_at == original_updated_at


@pytest.mark.asyncio
class TestUpdateEmail:
    @pytest.mark.auth
    async def test_update_email(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test updating a member's email (non-owner)."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )
        member = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            email="member@example.com",
            role=MemberRole.member,
        )

        updated_member = await member_service.update(
            session, member, email="  new@example.com  "
        )

        assert updated_member.id == member.id
        assert updated_member.email == "new@example.com"

    @pytest.mark.auth
    async def test_update_email_rejects_duplicate_in_customer(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Changing an email to one already used by another member of the same
        customer is rejected (case-insensitive)."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )
        await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            email="taken@example.com",
            role=MemberRole.owner,
        )
        member = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            email="member@example.com",
            role=MemberRole.member,
        )

        with pytest.raises(PolarRequestValidationError) as exc_info:
            await member_service.update(session, member, email="TAKEN@example.com")

        assert "already exists" in str(exc_info.value).lower()

    @pytest.mark.auth
    async def test_update_email_owner_individual_customer_blocked(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """The owner's email on an individual customer is auto-synced and cannot
        be edited directly."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )
        customer.type = CustomerType.individual
        await save_fixture(customer)

        owner = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            email="owner@example.com",
            role=MemberRole.owner,
        )

        with pytest.raises(PolarRequestValidationError) as exc_info:
            await member_service.update(session, owner, email="new@example.com")

        assert "individual customer" in str(exc_info.value).lower()

    @pytest.mark.auth
    async def test_update_email_owner_team_customer_allowed(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Team customers legitimately have members with distinct emails, so the
        owner email is editable there."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )
        customer.type = CustomerType.team
        await save_fixture(customer)

        owner = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            email="owner@example.com",
            role=MemberRole.owner,
        )

        updated_member = await member_service.update(
            session, owner, email="new@example.com"
        )

        assert updated_member.email == "new@example.com"

    @pytest.mark.auth
    async def test_update_email_allows_own_casing_change(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Re-casing a member's own email is not treated as a duplicate: the
        case-insensitive lookup matches the member itself, which is excluded."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )
        member = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            email="member@example.com",
            role=MemberRole.member,
        )

        updated_member = await member_service.update(
            session, member, email="Member@example.com"
        )

        assert updated_member.id == member.id
        assert updated_member.email == "Member@example.com"

    @pytest.mark.auth
    async def test_update_email_syncs_connected_seats(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Active seats connected to the member (member_id set) mirror the new
        email; revoked seats are not."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )
        customer.type = CustomerType.team
        await save_fixture(customer)
        member = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            email="member@example.com",
            role=MemberRole.member,
        )

        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )
        subscription = await create_subscription_with_seats(
            save_fixture, product=product, customer=customer, seats=5
        )
        pending_seat = CustomerSeat(
            subscription_id=subscription.id,
            customer_id=customer.id,
            member_id=member.id,
            email="member@example.com",
            status=SeatStatus.pending,
        )
        await save_fixture(pending_seat)
        claimed_seat = CustomerSeat(
            subscription_id=subscription.id,
            customer_id=customer.id,
            member_id=member.id,
            email="member@example.com",
            status=SeatStatus.claimed,
        )
        await save_fixture(claimed_seat)

        await member_service.update(session, member, email="new@example.com")

        await session.refresh(pending_seat)
        await session.refresh(claimed_seat)
        assert pending_seat.email == "new@example.com"
        assert claimed_seat.email == "new@example.com"

    @pytest.mark.auth
    async def test_update_email_leaves_seats_without_member_untouched(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """A seat with no member connected (member_id NULL, e.g. a legacy seat)
        is never touched when a member's email changes."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )
        customer.type = CustomerType.team
        await save_fixture(customer)
        member = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            email="member@example.com",
            role=MemberRole.member,
        )

        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )
        subscription = await create_subscription_with_seats(
            save_fixture, product=product, customer=customer, seats=5
        )
        unconnected_seat = CustomerSeat(
            subscription_id=subscription.id,
            customer_id=customer.id,
            member_id=None,
            email="member@example.com",
            status=SeatStatus.claimed,
        )
        await save_fixture(unconnected_seat)

        await member_service.update(session, member, email="new@example.com")

        await session.refresh(unconnected_seat)
        assert unconnected_seat.email == "member@example.com"


@pytest.mark.asyncio
class TestDelete:
    async def test_delete_member_enqueues_seat_revocation_job(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test that deleting a member enqueues a job to revoke their seats."""
        enqueue_job_mock: MagicMock = mocker.patch("polar.member.service.enqueue_job")

        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )

        # Create owner and a regular member
        owner = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="owner@example.com",
            name="Owner",
            role=MemberRole.owner,
        )
        await save_fixture(owner)

        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Member",
            role=MemberRole.member,
        )
        await save_fixture(member)

        deleted_member = await member_service.delete(session, member)

        # Verify member is soft-deleted
        assert deleted_member.id == member.id
        assert deleted_member.deleted_at is not None

        # Verify enqueue_job was called with correct parameters
        enqueue_job_mock.assert_called_once_with(
            "customer_seat.revoke_seats_for_member",
            member_id=member.id,
        )

    async def test_cannot_delete_only_owner(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test that the only owner cannot be deleted."""
        from polar.exceptions import PolarRequestValidationError

        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )

        owner = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="owner@example.com",
            name="Owner",
            role=MemberRole.owner,
        )
        await save_fixture(owner)

        with pytest.raises(PolarRequestValidationError) as exc_info:
            await member_service.delete(session, owner)

        assert "only owner" in str(exc_info.value).lower()


@pytest.mark.asyncio
class TestDeleteByCustomer:
    async def test_enqueues_seat_revocation_for_each_member(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        enqueue_job_mock: MagicMock = mocker.patch("polar.member.service.enqueue_job")

        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )
        owner = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="owner@example.com",
            name="Owner",
            role=MemberRole.owner,
        )
        await save_fixture(owner)
        regular = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="regular@example.com",
            name="Regular",
            role=MemberRole.member,
        )
        await save_fixture(regular)

        deleted = await member_service.delete_by_customer(session, customer.id)

        assert len(deleted) == 2
        assert all(m.deleted_at is not None for m in deleted)

        seat_revocation_calls = [
            c
            for c in enqueue_job_mock.call_args_list
            if c.args[0] == "customer_seat.revoke_seats_for_member"
        ]
        assert len(seat_revocation_calls) == 2
        revoked_member_ids = {c.kwargs["member_id"] for c in seat_revocation_calls}
        assert revoked_member_ids == {owner.id, regular.id}

    async def test_enqueues_benefit_grant_deletions_for_each_member(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        enqueue_member_mock: MagicMock = mocker.patch(
            "polar.benefit.grant.service.BenefitGrantService"
            ".enqueue_member_grant_deletions"
        )

        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )
        owner = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="owner@example.com",
            name="Owner",
            role=MemberRole.owner,
        )
        await save_fixture(owner)

        await member_service.delete_by_customer(session, customer.id)

        enqueue_member_mock.assert_called_once_with(session, owner.id)

    async def test_skips_owner_guard(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """delete_by_customer should delete the only owner without raising."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )
        owner = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="owner@example.com",
            name="Owner",
            role=MemberRole.owner,
        )
        await save_fixture(owner)

        deleted = await member_service.delete_by_customer(session, customer.id)

        assert len(deleted) == 1
        assert deleted[0].deleted_at is not None

    async def test_no_members_returns_empty(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )

        deleted = await member_service.delete_by_customer(session, customer.id)

        assert deleted == []


@pytest.mark.asyncio
class TestGetOrCreateByEmail:
    async def test_creates_new_member(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test that a new member is created when none exists."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )

        member = await member_service.get_or_create_by_email(
            session,
            customer_id=customer.id,
            organization_id=organization.id,
            email="new@example.com",
            name="New Member",
        )

        assert member is not None
        assert member.customer_id == customer.id
        assert member.organization_id == organization.id
        assert member.email == "new@example.com"
        assert member.name == "New Member"
        assert member.role == MemberRole.member

    async def test_returns_existing_active_member(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test that an existing active member is returned."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )

        existing = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="existing@example.com",
            name="Existing",
            role=MemberRole.member,
        )
        await save_fixture(existing)

        member = await member_service.get_or_create_by_email(
            session,
            customer_id=customer.id,
            organization_id=organization.id,
            email="existing@example.com",
            name="Different Name",
        )

        assert member.id == existing.id
        assert member.name == "Existing"  # Not updated

    async def test_handles_integrity_error_race_condition(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test that IntegrityError from race condition is handled by re-lookup."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )

        # Pre-create the member so re-lookup finds it
        existing = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="race@example.com",
            name="Racer",
            role=MemberRole.member,
        )
        await save_fixture(existing)

        # Mock repository.create to raise IntegrityError, simulating a race
        original_create = MemberRepository.create

        call_count = 0

        async def mock_create(self: Any, model: Any, flush: bool = False) -> None:
            nonlocal call_count
            call_count += 1
            raise IntegrityError(
                "duplicate", params=None, orig=Exception("unique violation")
            )

        mocker.patch.object(MemberRepository, "create", mock_create)

        # Also need to ensure get_by_customer_id_and_email returns None first, then the existing member
        original_get = MemberRepository.get_by_customer_id_and_email

        get_call_count = 0

        async def mock_get(self: Any, customer_id: Any, email: Any) -> Member | None:
            nonlocal get_call_count
            get_call_count += 1
            if get_call_count == 1:
                return None  # First call: no existing member found
            return await original_get(self, customer_id, email)

        mocker.patch.object(MemberRepository, "get_by_customer_id_and_email", mock_get)

        member = await member_service.get_or_create_by_email(
            session,
            customer_id=customer.id,
            organization_id=organization.id,
            email="race@example.com",
        )

        assert member.id == existing.id
        assert call_count == 1  # create was attempted

    async def test_sets_external_id_on_creation(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test that external_id is set when creating a new member."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )

        member = await member_service.get_or_create_by_email(
            session,
            customer_id=customer.id,
            organization_id=organization.id,
            email="ext@example.com",
            external_id="ext_123",
        )

        assert member.external_id == "ext_123"
        assert member.email == "ext@example.com"

    async def test_sets_role_on_creation(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test that role is set when creating a new member."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )

        member = await member_service.get_or_create_by_email(
            session,
            customer_id=customer.id,
            organization_id=organization.id,
            email="owner@example.com",
            role=MemberRole.owner,
        )

        assert member.role == MemberRole.owner
