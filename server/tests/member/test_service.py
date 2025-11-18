import pytest

from polar.member.service import member_service
from polar.models import Customer, Organization
from polar.models.member import MemberRole
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer


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

    async def test_member_email_matches_customer(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test that member email always matches customer email."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        customer_email = "specific@example.com"
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email=customer_email,
            name="Specific User",
        )

        member = await member_service.create_owner_member(
            session, customer, organization
        )

        assert member is not None
        assert member.email == customer_email
        assert member.email == customer.email

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
