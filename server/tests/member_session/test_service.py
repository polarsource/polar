import uuid
from datetime import timedelta

import pytest
from pydantic import HttpUrl

from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.exceptions import NotPermitted, PolarRequestValidationError
from polar.kit.utils import utc_now
from polar.member_session.schemas import MemberSessionCreate
from polar.member_session.service import member_session
from polar.models import Member, Organization, User, UserOrganization
from polar.models.member import MemberRole
from polar.models.member_session import MEMBER_SESSION_TOKEN_PREFIX, MemberSession
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer


@pytest.mark.asyncio
class TestCreateMemberSession:
    async def test_creates_session_with_token(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, email="test@example.com"
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            name="Test Member",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        token, member_session_obj = await member_session.create_member_session(
            session, member
        )

        assert token.startswith(MEMBER_SESSION_TOKEN_PREFIX)
        assert member_session_obj.member_id == member.id
        assert member_session_obj.return_url is None
        assert member_session_obj.expires_at > utc_now()

    async def test_creates_session_with_return_url(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, email="test@example.com"
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            name="Test Member",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        return_url = HttpUrl("https://example.com/return")
        token, member_session_obj = await member_session.create_member_session(
            session, member, return_url=return_url
        )

        assert token.startswith(MEMBER_SESSION_TOKEN_PREFIX)
        assert member_session_obj.return_url == str(return_url)


@pytest.mark.asyncio
class TestCreate:
    """Tests for the create() method that validates feature flags and auth."""

    async def test_creates_session_with_valid_flags(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        # Enable both feature flags
        organization.feature_settings = {
            "member_model_enabled": True,
            "seat_based_pricing_enabled": True,
        }
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture, organization=organization, email="test@example.com"
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            name="Test Member",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        auth_subject = AuthSubject(user, {Scope.web_write}, None)
        create_schema = MemberSessionCreate(member_id=member.id)

        result = await member_session.create(session, auth_subject, create_schema)

        assert result.raw_token is not None
        assert result.raw_token.startswith(MEMBER_SESSION_TOKEN_PREFIX)
        assert result.member_id == member.id
        assert result.member.customer.id == customer.id

    async def test_creates_session_with_return_url(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        organization.feature_settings = {
            "member_model_enabled": True,
            "seat_based_pricing_enabled": True,
        }
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture, organization=organization, email="test@example.com"
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            name="Test Member",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        auth_subject = AuthSubject(user, {Scope.web_write}, None)
        create_schema = MemberSessionCreate(
            member_id=member.id,
            return_url=HttpUrl("https://example.com/return"),
        )

        result = await member_session.create(session, auth_subject, create_schema)

        assert result.return_url == "https://example.com/return"

    async def test_error_member_not_found(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        organization.feature_settings = {
            "member_model_enabled": True,
            "seat_based_pricing_enabled": True,
        }
        await save_fixture(organization)

        auth_subject = AuthSubject(user, {Scope.web_write}, None)
        create_schema = MemberSessionCreate(member_id=uuid.uuid4())

        with pytest.raises(PolarRequestValidationError) as exc_info:
            await member_session.create(session, auth_subject, create_schema)

        assert exc_info.value.errors()[0]["loc"] == ("body", "member_id")
        assert "does not exist" in exc_info.value.errors()[0]["msg"]

    async def test_error_member_not_accessible(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        # Create member in a different organization that user can't access
        organization_second.feature_settings = {
            "member_model_enabled": True,
            "seat_based_pricing_enabled": True,
        }
        await save_fixture(organization_second)

        customer = await create_customer(
            save_fixture, organization=organization_second, email="test@example.com"
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization_second.id,
            email=customer.email,
            name="Test Member",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        auth_subject = AuthSubject(user, {Scope.web_write}, None)
        create_schema = MemberSessionCreate(member_id=member.id)

        with pytest.raises(PolarRequestValidationError) as exc_info:
            await member_session.create(session, auth_subject, create_schema)

        assert exc_info.value.errors()[0]["loc"] == ("body", "member_id")

    async def test_error_member_model_not_enabled(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        # Only seat_based_pricing_enabled, not member_model_enabled
        organization.feature_settings = {
            "member_model_enabled": False,
            "seat_based_pricing_enabled": True,
        }
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture, organization=organization, email="test@example.com"
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            name="Test Member",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        auth_subject = AuthSubject(user, {Scope.web_write}, None)
        create_schema = MemberSessionCreate(member_id=member.id)

        with pytest.raises(NotPermitted) as exc_info:
            await member_session.create(session, auth_subject, create_schema)

        assert "member_model_enabled" in str(exc_info.value)

    async def test_error_seat_based_pricing_not_enabled(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        # Only member_model_enabled, not seat_based_pricing_enabled
        organization.feature_settings = {
            "member_model_enabled": True,
            "seat_based_pricing_enabled": False,
        }
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture, organization=organization, email="test@example.com"
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            name="Test Member",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        auth_subject = AuthSubject(user, {Scope.web_write}, None)
        create_schema = MemberSessionCreate(member_id=member.id)

        with pytest.raises(NotPermitted) as exc_info:
            await member_session.create(session, auth_subject, create_schema)

        assert "seat_based_pricing_enabled" in str(exc_info.value)

    async def test_creates_session_with_organization_auth(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test that organization auth subject can create sessions."""
        organization.feature_settings = {
            "member_model_enabled": True,
            "seat_based_pricing_enabled": True,
        }
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture, organization=organization, email="test@example.com"
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            name="Test Member",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        auth_subject = AuthSubject(organization, {Scope.web_write}, None)
        create_schema = MemberSessionCreate(member_id=member.id)

        result = await member_session.create(session, auth_subject, create_schema)

        assert result.raw_token is not None
        assert result.member_id == member.id


@pytest.mark.asyncio
class TestGetByToken:
    async def test_returns_session_for_valid_token(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, email="test@example.com"
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            name="Test Member",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        token, created_session = await member_session.create_member_session(
            session, member
        )

        retrieved_session = await member_session.get_by_token(session, token)

        assert retrieved_session is not None
        assert retrieved_session.id == created_session.id
        assert retrieved_session.member_id == member.id

    async def test_returns_none_for_invalid_token(
        self,
        session: AsyncSession,
    ) -> None:
        result = await member_session.get_by_token(
            session, f"{MEMBER_SESSION_TOKEN_PREFIX}invalid_token_123"
        )
        assert result is None

    async def test_returns_none_for_expired_session(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, email="test@example.com"
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            name="Test Member",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        token, created_session = await member_session.create_member_session(
            session, member
        )
        created_session.expires_at = utc_now() - timedelta(hours=1)
        await save_fixture(created_session)

        result = await member_session.get_by_token(session, token)
        assert result is None

    async def test_returns_expired_session_when_flag_set(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, email="test@example.com"
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            name="Test Member",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        token, created_session = await member_session.create_member_session(
            session, member
        )
        created_session.expires_at = utc_now() - timedelta(hours=1)
        await save_fixture(created_session)

        result = await member_session.get_by_token(session, token, expired=True)
        assert result is not None
        assert result.id == created_session.id

    async def test_returns_none_for_deleted_member(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, email="test@example.com"
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            name="Test Member",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        token, _ = await member_session.create_member_session(session, member)
        member.deleted_at = utc_now()
        await save_fixture(member)

        result = await member_session.get_by_token(session, token)
        assert result is None

    async def test_eagerly_loads_member_and_customer(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, email="test@example.com"
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            name="Test Member",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        token, _ = await member_session.create_member_session(session, member)
        await session.flush()

        retrieved_session = await member_session.get_by_token(session, token)
        assert retrieved_session is not None

        # Verify the relationships are loaded and accessible
        # Member.customer has lazy="raise", so this would fail if not eagerly loaded
        assert retrieved_session.member.id == member.id
        assert retrieved_session.member.customer.id == customer.id
        assert retrieved_session.member.customer.organization.id == organization.id


@pytest.mark.asyncio
class TestDeleteExpired:
    async def test_deletes_expired_sessions(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, email="test@example.com"
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            name="Test Member",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        # Create an expired session
        expired_session = MemberSession(
            token="expired_token_hash",
            member_id=member.id,
            expires_at=utc_now() - timedelta(hours=1),
        )
        await save_fixture(expired_session)

        # Create a valid session
        valid_token, valid_session = await member_session.create_member_session(
            session, member
        )

        await member_session.delete_expired(session)
        await session.commit()

        # The valid session should still exist
        result = await member_session.get_by_token(session, valid_token)
        assert result is not None

        # The expired session should be deleted
        result = await member_session.get_by_token(
            session, "expired_token_hash", expired=True
        )
        assert result is None
