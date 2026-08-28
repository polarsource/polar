import uuid

import pytest

from polar.benefit.grant.scope import (
    CustomerDoesntHaveOwnerMember,
    MemberIdRequired,
    MemberNotFound,
    resolve_member,
)
from polar.enums import SubscriptionRecurringInterval
from polar.models import Account, Member
from polar.models.customer_seat import SeatStatus
from polar.models.member import MemberRole
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_customer_seat,
    create_organization,
    create_product,
    create_subscription,
)


@pytest.mark.asyncio
class TestResolveMember:
    """Tests for resolve_member() function in scope.py"""

    async def test_feature_flag_disabled_uses_explicit_member_id(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """When feature flag is disabled, explicit member_id is still used."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": False}
        )
        customer = await create_customer(save_fixture, organization=organization)

        # Create a member
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Test Member",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        result = await resolve_member(
            session,
            customer_id=customer.id,
            organization=organization,
            member_id=member.id,  # Explicit member_id provided
            is_seat_based=False,
        )

        assert result is not None
        assert result.id == member.id

    async def test_feature_flag_disabled_no_member_id_returns_none(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """When feature flag is disabled and no member_id, returns None."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": False}
        )
        customer = await create_customer(save_fixture, organization=organization)

        result = await resolve_member(
            session,
            customer_id=customer.id,
            organization=organization,
            member_id=None,
            is_seat_based=False,
        )

        assert result is None

    async def test_phase_1_links_direct_purchase_to_owner_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """Phase 1: seat-based org, flag off, direct purchase resolves the owner member.

        Keeps `grant.member` populated before the member model is enabled, so the
        backlog of member_id NULL grants doesn't grow between prepare and flip.
        """
        organization = await create_organization(
            save_fixture,
            account,
            feature_settings={
                "member_model_enabled": False,
                "seat_based_pricing_enabled": True,
            },
        )
        customer = await create_customer(save_fixture, organization=organization)

        result = await resolve_member(
            session,
            customer_id=customer.id,
            organization=organization,
            member_id=None,
            is_seat_based=False,
        )

        assert result is not None
        assert result.customer_id == customer.id
        assert result.role == MemberRole.owner

    async def test_phase_1_seat_holder_resolves_the_seat_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """Phase 1: a seat holder's grant resolves the member on their seat.

        That member lives under the buyer, not under the holder's own customer,
        so resolving the holder's owner member would attach the wrong identity.
        """
        organization = await create_organization(
            save_fixture,
            account,
            feature_settings={
                "member_model_enabled": False,
                "seat_based_pricing_enabled": True,
            },
        )
        buyer = await create_customer(
            save_fixture, organization=organization, email="buyer@example.com"
        )
        holder = await create_customer(
            save_fixture, organization=organization, email="holder@example.com"
        )
        seat_member = Member(
            customer_id=buyer.id,
            organization_id=organization.id,
            email=holder.email,
            name="Seat holder",
            role=MemberRole.member,
        )
        await save_fixture(seat_member)
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        subscription = await create_subscription(
            save_fixture, product=product, customer=buyer
        )
        await create_customer_seat(
            save_fixture,
            subscription=subscription,
            customer=holder,
            status=SeatStatus.claimed,
            member_id=seat_member.id,
        )

        result = await resolve_member(
            session,
            customer_id=holder.id,
            organization=organization,
            member_id=None,
            is_seat_based=True,
        )

        assert result is not None
        assert result.id == seat_member.id
        assert result.customer_id == buyer.id

    async def test_phase_1_customer_without_email_returns_none(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """Phase 1 linking is best effort: an email-less customer still gets its grant.

        `create_owner_member` can't build an owner member without an email, and
        the member model isn't active yet, so the grant is created with a null
        member instead of failing.
        """
        organization = await create_organization(
            save_fixture,
            account,
            feature_settings={
                "member_model_enabled": False,
                "seat_based_pricing_enabled": True,
            },
        )
        customer = await create_customer(save_fixture, organization=organization)
        customer.email = None
        await save_fixture(customer)

        result = await resolve_member(
            session,
            customer_id=customer.id,
            organization=organization,
            member_id=None,
            is_seat_based=False,
        )

        assert result is None

    async def test_phase_1_seat_product_buyer_resolves_owner_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """Phase 1: buying a seat-based product without holding a seat links the buyer.

        The grant belongs to the buyer, so it resolves their owner member rather
        than being left unlinked for the backfill to pick up later.
        """
        organization = await create_organization(
            save_fixture,
            account,
            feature_settings={
                "member_model_enabled": False,
                "seat_based_pricing_enabled": True,
            },
        )
        customer = await create_customer(save_fixture, organization=organization)

        result = await resolve_member(
            session,
            customer_id=customer.id,
            organization=organization,
            member_id=None,
            is_seat_based=True,
        )

        assert result is not None
        assert result.customer_id == customer.id
        assert result.role == MemberRole.owner

    async def test_phase_1_reuses_existing_owner_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """Phase 1 resolution reuses the existing owner instead of creating a second one."""
        organization = await create_organization(
            save_fixture,
            account,
            feature_settings={
                "member_model_enabled": False,
                "seat_based_pricing_enabled": True,
            },
        )
        customer = await create_customer(save_fixture, organization=organization)
        owner = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            name="Owner",
            role=MemberRole.owner,
        )
        await save_fixture(owner)

        result = await resolve_member(
            session,
            customer_id=customer.id,
            organization=organization,
            member_id=None,
            is_seat_based=False,
        )

        assert result is not None
        assert result.id == owner.id

    async def test_explicit_member_id_returns_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """When feature flag enabled and member_id provided, load and return that member."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(save_fixture, organization=organization)

        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Test Member",
            role=MemberRole.member,
        )
        await save_fixture(member)

        result = await resolve_member(
            session,
            customer_id=customer.id,
            organization=organization,
            member_id=member.id,
            is_seat_based=False,
        )

        assert result is not None
        assert result.id == member.id

    async def test_b2c_auto_resolves_owner_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """B2C (non-seat-based) with feature flag enabled auto-resolves owner member."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(save_fixture, organization=organization)

        # Create owner member for the customer
        owner_member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="owner@example.com",
            name="Owner Member",
            role=MemberRole.owner,
        )
        await save_fixture(owner_member)

        result = await resolve_member(
            session,
            customer_id=customer.id,
            organization=organization,
            member_id=None,  # No explicit member_id
            is_seat_based=False,  # B2C - not seat-based
        )

        assert result is not None
        assert result.id == owner_member.id
        assert result.role == MemberRole.owner

    async def test_b2c_auto_creates_owner_member_when_missing(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """B2C with feature flag enabled but no owner member auto-creates one."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(save_fixture, organization=organization)

        # No member exists — should auto-create
        result = await resolve_member(
            session,
            customer_id=customer.id,
            organization=organization,
            member_id=None,
            is_seat_based=False,
        )

        assert result is not None
        assert result.customer_id == customer.id
        assert result.role == MemberRole.owner
        assert result.email == customer.email

    async def test_b2c_auto_creates_owner_when_only_regular_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """B2C auto-creates owner member even when only regular member exists."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(save_fixture, organization=organization)

        regular_member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="regular@example.com",
            name="Regular Member",
            role=MemberRole.member,  # not owner
        )
        await save_fixture(regular_member)

        result = await resolve_member(
            session,
            customer_id=customer.id,
            organization=organization,
            member_id=None,
            is_seat_based=False,
        )

        assert result is not None
        assert result.role == MemberRole.owner
        assert result.customer_id == customer.id

    async def test_b2b_without_member_id_raises_error(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """B2B (seat-based) with feature flag enabled but no member_id raises MemberIdRequired."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(save_fixture, organization=organization)

        with pytest.raises(MemberIdRequired):
            await resolve_member(
                session,
                customer_id=customer.id,
                organization=organization,
                member_id=None,  # No member_id provided
                is_seat_based=True,  # B2B - seat-based
            )

    async def test_b2b_with_member_id_returns_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """B2B (seat-based) with explicit member_id returns that member."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(save_fixture, organization=organization)

        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="seat-holder@example.com",
            name="Seat Holder",
            role=MemberRole.member,
        )
        await save_fixture(member)

        result = await resolve_member(
            session,
            customer_id=customer.id,
            organization=organization,
            member_id=member.id,
            is_seat_based=True,
        )

        assert result is not None
        assert result.id == member.id

    async def test_b2c_raises_when_customer_not_found(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """B2C: When customer_id doesn't match any customer, raises error."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": True}
        )
        fake_customer_id = uuid.uuid4()

        with pytest.raises(CustomerDoesntHaveOwnerMember):
            await resolve_member(
                session,
                customer_id=fake_customer_id,
                organization=organization,
                member_id=None,
                is_seat_based=False,
            )

    async def test_b2c_deleted_owner_not_found_without_include_deleted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """B2C: Soft-deleted owner member is not found without include_deleted."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(save_fixture, organization=organization)

        owner_member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            name="Owner",
            role=MemberRole.owner,
        )
        owner_member.set_deleted_at()
        await save_fixture(owner_member)

        # Without include_deleted, the deleted owner is invisible
        # and auto-create is attempted (but customer still exists so it succeeds)
        result = await resolve_member(
            session,
            customer_id=customer.id,
            organization=organization,
            member_id=None,
            is_seat_based=False,
        )

        assert result is not None
        assert result.id != owner_member.id  # New member, not the deleted one

    async def test_b2c_deleted_owner_found_with_include_deleted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """B2C: Soft-deleted owner member is found with include_deleted=True.
        This is the benefit.revoke path for deleted customers."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(save_fixture, organization=organization)

        owner_member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            name="Owner",
            role=MemberRole.owner,
        )
        owner_member.set_deleted_at()
        await save_fixture(owner_member)

        # Soft-delete the customer too (matches the real scenario)
        customer.set_deleted_at()
        await save_fixture(customer)

        result = await resolve_member(
            session,
            customer_id=customer.id,
            organization=organization,
            member_id=None,
            is_seat_based=False,
            include_deleted=True,
        )

        assert result is not None
        assert result.id == owner_member.id
        assert result.is_deleted

    async def test_nonexistent_member_id_b2b_raises_error(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """B2B: When explicit member_id doesn't exist, raises MemberNotFound."""

        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(save_fixture, organization=organization)

        nonexistent_id = uuid.uuid4()
        with pytest.raises(MemberNotFound) as exc_info:
            await resolve_member(
                session,
                customer_id=customer.id,
                organization=organization,
                member_id=nonexistent_id,  # Non-existent member ID
                is_seat_based=True,  # B2B - seat-based
            )

        assert exc_info.value.member_id == nonexistent_id
