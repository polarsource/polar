import pytest

from polar.auth.models import AuthSubject
from polar.kit.pagination import PaginationParams
from polar.member.service import member_service
from polar.models import Customer, Member, Organization, User, UserOrganization
from polar.models.customer_seat import SeatStatus
from polar.models.member import MemberRole
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_customer_seat,
    create_product,
    create_subscription_with_seats,
)


@pytest.mark.asyncio
class TestList:
    @pytest.mark.auth
    async def test_not_accessible_organization(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
    ) -> None:
        """Test that user cannot access members from organizations they don't belong to."""
        from tests.fixtures.random_objects import create_organization

        other_org = await create_organization(save_fixture)
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
        from polar.exceptions import NotPermitted
        from polar.models.customer import CustomerType

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
        from polar.models.customer import CustomerType

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

        assert "must have exactly one owner" in str(exc_info.value).lower()

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
class TestDelete:
    async def test_delete_member_without_seats(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test that a member without seats can be deleted normally."""
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

        assert deleted_member.id == member.id
        assert deleted_member.deleted_at is not None

    async def test_delete_member_revokes_active_seats(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test that deleting a member with active seats automatically revokes them."""
        from polar.enums import SubscriptionRecurringInterval
        from polar.kit.utils import utc_now
        from polar.models.subscription import SubscriptionStatus

        # Enable seat-based pricing
        organization.feature_settings = {
            **organization.feature_settings,
            "seat_based_pricing_enabled": True,
            "member_model_enabled": True,
        }
        await save_fixture(organization)

        # Create billing customer
        billing_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="billing@example.com",
        )

        # Create product with seat pricing
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )

        # Create subscription with seats
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=billing_customer,
            seats=5,
            status=SubscriptionStatus.active,
            started_at=utc_now(),
        )

        # Create owner member
        owner = Member(
            customer_id=billing_customer.id,
            organization_id=organization.id,
            email="owner@example.com",
            name="Owner",
            role=MemberRole.owner,
        )
        await save_fixture(owner)

        # Create a member that will be deleted
        member = Member(
            customer_id=billing_customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Member To Delete",
            role=MemberRole.member,
        )
        await save_fixture(member)

        # Create a claimed seat for this member
        seat = await create_customer_seat(
            save_fixture,
            subscription=subscription,
            customer=billing_customer,
            status=SeatStatus.claimed,
            claimed_at=utc_now(),
            member_id=member.id,
            email=member.email,
        )

        # Refresh to load relationships needed for revoke_seat
        await session.refresh(seat, ["subscription"])
        assert seat.subscription is not None
        await session.refresh(seat.subscription, ["product"])
        assert seat.subscription.product is not None
        await session.refresh(seat.subscription.product, ["organization"])

        # Delete the member
        deleted_member = await member_service.delete(session, member)

        # Verify member is soft-deleted
        assert deleted_member.deleted_at is not None

        # Verify seat was revoked
        await session.refresh(seat)
        assert seat.status == SeatStatus.revoked
        assert seat.member_id is None
        assert seat.customer_id is None
        assert seat.revoked_at is not None

    async def test_delete_member_revokes_multiple_seats(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test that deleting a member revokes all their active seats."""
        from polar.enums import SubscriptionRecurringInterval
        from polar.kit.utils import utc_now
        from polar.models.subscription import SubscriptionStatus

        organization.feature_settings = {
            **organization.feature_settings,
            "seat_based_pricing_enabled": True,
            "member_model_enabled": True,
        }
        await save_fixture(organization)

        billing_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="billing@example.com",
        )

        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )

        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=billing_customer,
            seats=10,
            status=SubscriptionStatus.active,
            started_at=utc_now(),
        )

        owner = Member(
            customer_id=billing_customer.id,
            organization_id=organization.id,
            email="owner@example.com",
            name="Owner",
            role=MemberRole.owner,
        )
        await save_fixture(owner)

        member = Member(
            customer_id=billing_customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Member To Delete",
            role=MemberRole.member,
        )
        await save_fixture(member)

        # Create multiple seats for the same member (e.g., from different products)
        seats = []
        for i in range(3):
            seat = await create_customer_seat(
                save_fixture,
                subscription=subscription,
                customer=billing_customer,
                status=SeatStatus.claimed,
                claimed_at=utc_now(),
                member_id=member.id,
                email=member.email,
            )
            await session.refresh(seat, ["subscription"])
            assert seat.subscription is not None
            await session.refresh(seat.subscription, ["product"])
            assert seat.subscription.product is not None
            await session.refresh(seat.subscription.product, ["organization"])
            seats.append(seat)

        # Delete the member
        deleted_member = await member_service.delete(session, member)

        assert deleted_member.deleted_at is not None

        # Verify all seats were revoked
        for seat in seats:
            await session.refresh(seat)
            assert seat.status == SeatStatus.revoked
            assert seat.member_id is None

    async def test_delete_member_does_not_revoke_other_members_seats(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test that deleting a member does not affect other members' seats."""
        from polar.enums import SubscriptionRecurringInterval
        from polar.kit.utils import utc_now
        from polar.models.subscription import SubscriptionStatus

        organization.feature_settings = {
            **organization.feature_settings,
            "seat_based_pricing_enabled": True,
            "member_model_enabled": True,
        }
        await save_fixture(organization)

        billing_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="billing@example.com",
        )

        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )

        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=billing_customer,
            seats=10,
            status=SubscriptionStatus.active,
            started_at=utc_now(),
        )

        owner = Member(
            customer_id=billing_customer.id,
            organization_id=organization.id,
            email="owner@example.com",
            name="Owner",
            role=MemberRole.owner,
        )
        await save_fixture(owner)

        member_to_delete = Member(
            customer_id=billing_customer.id,
            organization_id=organization.id,
            email="member1@example.com",
            name="Member To Delete",
            role=MemberRole.member,
        )
        await save_fixture(member_to_delete)

        other_member = Member(
            customer_id=billing_customer.id,
            organization_id=organization.id,
            email="member2@example.com",
            name="Other Member",
            role=MemberRole.member,
        )
        await save_fixture(other_member)

        # Create seat for member to delete
        seat_to_revoke = await create_customer_seat(
            save_fixture,
            subscription=subscription,
            customer=billing_customer,
            status=SeatStatus.claimed,
            claimed_at=utc_now(),
            member_id=member_to_delete.id,
            email=member_to_delete.email,
        )
        await session.refresh(seat_to_revoke, ["subscription"])
        assert seat_to_revoke.subscription is not None
        await session.refresh(seat_to_revoke.subscription, ["product"])
        assert seat_to_revoke.subscription.product is not None
        await session.refresh(seat_to_revoke.subscription.product, ["organization"])

        # Create seat for other member
        other_seat = await create_customer_seat(
            save_fixture,
            subscription=subscription,
            customer=billing_customer,
            status=SeatStatus.claimed,
            claimed_at=utc_now(),
            member_id=other_member.id,
            email=other_member.email,
        )

        # Delete the first member
        await member_service.delete(session, member_to_delete)

        # Verify first member's seat was revoked
        await session.refresh(seat_to_revoke)
        assert seat_to_revoke.status == SeatStatus.revoked
        assert seat_to_revoke.member_id is None

        # Verify other member's seat is unchanged
        await session.refresh(other_seat)
        assert other_seat.status == SeatStatus.claimed
        assert other_seat.member_id == other_member.id

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
