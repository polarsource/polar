import uuid

import pytest

from polar.benefit.grant.scope import (
    CustomerDoesntHaveOwnerMember,
    InvalidScopeError,
    MemberIdRequired,
    MemberNotFound,
    resolve_member,
    resolve_selector,
)
from polar.models import Account, BenefitGrant, Member, Order, Product, Subscription
from polar.models.member import MemberRole
from polar.models.product_price import ProductPriceSeatUnit
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer, create_organization


@pytest.mark.anyio
class TestResolveSelector:
    async def test_rejects_empty_and_mixed_selectors(
        self, session: AsyncSession
    ) -> None:
        grant_id = uuid.uuid4()
        customer_id, benefit_id = uuid.uuid4(), uuid.uuid4()
        with pytest.raises(InvalidScopeError):
            await resolve_selector(
                session, {}, customer_id=customer_id, benefit_id=benefit_id
            )
        with pytest.raises(InvalidScopeError):
            await resolve_selector(
                session,
                {"benefit_grant_id": grant_id, "order_id": uuid.uuid4()},
                customer_id=customer_id,
                benefit_id=benefit_id,
            )
        with pytest.raises(ValueError, match="cannot be combined"):
            _ = BenefitGrant.scope == {"benefit_grant_id": grant_id, "order": object()}


@pytest.fixture
def purchase_subscription() -> Subscription:
    return Subscription(product=Product())


@pytest.fixture
def seat_based_subscription() -> Subscription:
    return Subscription(product=Product(prices=[ProductPriceSeatUnit()]))


@pytest.mark.anyio
class TestResolveMember:
    """Tests for resolve_member() function in scope.py"""

    async def test_feature_flag_disabled_uses_explicit_member_id(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
        purchase_subscription: Subscription,
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
            selector={"subscription": purchase_subscription},
        )

        assert result is not None
        assert result.id == member.id

    async def test_feature_flag_disabled_resolves_owner_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
        purchase_subscription: Subscription,
    ) -> None:
        """A direct purchase links the owner member even before the flip."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": False}
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
            selector={"subscription": purchase_subscription},
        )

        assert result is not None
        assert result.id == owner.id

    async def test_feature_flag_disabled_creates_owner_member_when_missing(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
        purchase_subscription: Subscription,
    ) -> None:
        """A legacy customer without an owner member gets one."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": False}
        )
        customer = await create_customer(save_fixture, organization=organization)

        result = await resolve_member(
            session,
            customer_id=customer.id,
            organization=organization,
            member_id=None,
            selector={"subscription": purchase_subscription},
        )

        assert result is not None
        assert result.customer_id == customer.id
        assert result.role == MemberRole.owner
        assert result.email == customer.email

    async def test_explicit_member_id_returns_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
        purchase_subscription: Subscription,
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
            selector={"subscription": purchase_subscription},
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
            selector={"order": Order(product=Product())},
        )

        assert result is not None
        assert result.id == owner_member.id
        assert result.role == MemberRole.owner

    async def test_b2c_auto_creates_owner_member_when_missing(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
        purchase_subscription: Subscription,
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
            selector={"subscription": purchase_subscription},
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
        purchase_subscription: Subscription,
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
            selector={"subscription": purchase_subscription},
        )

        assert result is not None
        assert result.role == MemberRole.owner
        assert result.customer_id == customer.id

    async def test_b2b_without_member_id_raises_error(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
        seat_based_subscription: Subscription,
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
                selector={"subscription": seat_based_subscription},
            )

    async def test_b2b_with_member_id_returns_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
        seat_based_subscription: Subscription,
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
            selector={"subscription": seat_based_subscription},
        )

        assert result is not None
        assert result.id == member.id

    async def test_b2c_raises_when_customer_not_found(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
        purchase_subscription: Subscription,
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
                selector={"subscription": purchase_subscription},
            )

    async def test_b2c_deleted_owner_not_found_without_include_deleted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
        purchase_subscription: Subscription,
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
            selector={"subscription": purchase_subscription},
        )

        assert result is not None
        assert result.id != owner_member.id  # New member, not the deleted one

    async def test_b2c_deleted_owner_found_with_include_deleted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
        purchase_subscription: Subscription,
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
            selector={"subscription": purchase_subscription},
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
        seat_based_subscription: Subscription,
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
                selector={"subscription": seat_based_subscription},
            )

        assert exc_info.value.member_id == nonexistent_id
