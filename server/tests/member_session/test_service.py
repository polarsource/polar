from datetime import timedelta

import pytest
from pydantic import HttpUrl

from polar.kit.utils import utc_now
from polar.member_session.service import (
    MEMBER_SESSION_TOKEN_PREFIX,
    member_session,
)
from polar.models import Member, Organization
from polar.models.member import MemberRole
from polar.models.member_session import MemberSession
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
