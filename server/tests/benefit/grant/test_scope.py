import uuid

import pytest

from polar.benefit.grant.scope import (
    CustomerDoesntHaveOwnerMember,
    MemberIdRequired,
    MemberNotFound,
    resolve_member,
)
from polar.models import Member
from polar.models.member import MemberRole
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer, create_organization


@pytest.mark.asyncio
class TestResolveMember:
    """Tests for resolve_member() function in scope.py"""

    async def test_feature_flag_disabled_returns_none(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """When member_model_enabled is False, should return None regardless of inputs."""
        organization = await create_organization(
            save_fixture, feature_settings={"member_model_enabled": False}
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

    async def test_feature_flag_disabled_ignores_explicit_member_id(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """When feature flag is disabled, even explicit member_id is ignored."""
        organization = await create_organization(
            save_fixture, feature_settings={"member_model_enabled": False}
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

        assert result is None

    async def test_explicit_member_id_returns_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """When feature flag enabled and member_id provided, load and return that member."""
        organization = await create_organization(
            save_fixture, feature_settings={"member_model_enabled": True}
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
    ) -> None:
        """B2C (non-seat-based) with feature flag enabled auto-resolves owner member."""
        organization = await create_organization(
            save_fixture, feature_settings={"member_model_enabled": True}
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

    async def test_b2c_raises_when_no_owner_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """B2C with feature flag enabled but no owner member raises CustomerDoesntHaveOwnerMember."""
        organization = await create_organization(
            save_fixture, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(save_fixture, organization=organization)

        # Don't create any member for the customer

        with pytest.raises(CustomerDoesntHaveOwnerMember):
            await resolve_member(
                session,
                customer_id=customer.id,
                organization=organization,
                member_id=None,
                is_seat_based=False,
            )

    async def test_b2c_raises_when_only_regular_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """B2C auto-resolve raises when only regular member exists (no owner)."""
        organization = await create_organization(
            save_fixture, feature_settings={"member_model_enabled": True}
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

        with pytest.raises(CustomerDoesntHaveOwnerMember):
            await resolve_member(
                session,
                customer_id=customer.id,
                organization=organization,
                member_id=None,
                is_seat_based=False,
            )

    async def test_b2b_without_member_id_raises_error(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """B2B (seat-based) with feature flag enabled but no member_id raises MemberIdRequired."""
        organization = await create_organization(
            save_fixture, feature_settings={"member_model_enabled": True}
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
    ) -> None:
        """B2B (seat-based) with explicit member_id returns that member."""
        organization = await create_organization(
            save_fixture, feature_settings={"member_model_enabled": True}
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

    async def test_nonexistent_member_id_b2c_raises_error(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """B2C: When explicit member_id doesn't exist raises error"""
        organization = await create_organization(
            save_fixture, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(save_fixture, organization=organization)

        with pytest.raises(CustomerDoesntHaveOwnerMember) as exc_info:
            await resolve_member(
                session,
                customer_id=customer.id,
                organization=organization,
                member_id=None,
                is_seat_based=False,
            )

    async def test_nonexistent_member_id_b2b_raises_error(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """B2B: When explicit member_id doesn't exist, raises MemberNotFound."""

        organization = await create_organization(
            save_fixture, feature_settings={"member_model_enabled": True}
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
