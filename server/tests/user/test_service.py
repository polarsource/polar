import pytest
from sqlalchemy import select

from polar.kit.utils import utc_now
from polar.models import OAuthAccount, Organization, User, UserOrganization
from polar.models.user import OAuthPlatform
from polar.postgres import AsyncSession
from polar.user.schemas import UserDeletionBlockedReason
from polar.user.service import user as user_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_oauth_account


@pytest.mark.asyncio
class TestCheckCanDelete:
    async def test_can_delete_no_organizations(
        self,
        session: AsyncSession,
        user: User,
    ) -> None:
        """User with no organizations can be deleted."""
        result = await user_service.check_can_delete(session, user)

        assert result.blocked_reasons == []
        assert result.blocking_organizations == []

    async def test_blocked_with_active_organization(
        self,
        session: AsyncSession,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """User with active organization cannot be deleted."""
        result = await user_service.check_can_delete(session, user)

        assert (
            UserDeletionBlockedReason.HAS_ACTIVE_ORGANIZATIONS in result.blocked_reasons
        )
        assert len(result.blocking_organizations) == 1
        assert result.blocking_organizations[0].id == organization.id
        assert result.blocking_organizations[0].slug == organization.slug

    async def test_can_delete_with_deleted_organization(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """User can be deleted if all organizations are soft-deleted."""
        organization.deleted_at = utc_now()
        await save_fixture(organization)

        result = await user_service.check_can_delete(session, user)

        assert result.blocked_reasons == []
        assert result.blocking_organizations == []

    async def test_can_delete_with_deleted_membership(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """User can be deleted if membership is soft-deleted."""
        user_organization.deleted_at = utc_now()
        await save_fixture(user_organization)

        result = await user_service.check_can_delete(session, user)

        assert result.blocked_reasons == []
        assert result.blocking_organizations == []


@pytest.mark.asyncio
class TestRequestDeletion:
    async def test_immediate_deletion_no_organizations(
        self,
        session: AsyncSession,
        user: User,
    ) -> None:
        """User with no organizations is immediately deleted."""
        original_email = user.email

        result = await user_service.request_deletion(session, user)

        assert result.deleted is True
        assert result.blocked_reasons == []
        assert user.deleted_at is not None
        assert user.email != original_email
        assert user.email.endswith("@deleted.com")

    async def test_blocked_with_active_organization(
        self,
        session: AsyncSession,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """User with active organization is blocked from deletion."""
        result = await user_service.request_deletion(session, user)

        assert result.deleted is False
        assert (
            UserDeletionBlockedReason.HAS_ACTIVE_ORGANIZATIONS in result.blocked_reasons
        )
        assert len(result.blocking_organizations) == 1
        assert user.deleted_at is None

    async def test_anonymization(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
    ) -> None:
        """User PII is properly anonymized on deletion."""
        user.avatar_url = "https://example.com/avatar.png"
        user.meta = {"signup": {"intent": "creator"}}
        await save_fixture(user)

        original_email = user.email

        result = await user_service.request_deletion(session, user)

        assert result.deleted is True
        assert user.email != original_email
        assert user.email.endswith("@deleted.com")
        assert user.avatar_url is None
        assert user.meta == {}
        assert user.deleted_at is not None

    async def test_oauth_accounts_deleted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
    ) -> None:
        """OAuth accounts are deleted when user is deleted."""
        await create_oauth_account(save_fixture, user, OAuthPlatform.github)
        await create_oauth_account(save_fixture, user, OAuthPlatform.google)

        stmt = select(OAuthAccount).where(OAuthAccount.user_id == user.id)
        result = await session.execute(stmt)
        assert len(result.scalars().all()) == 2

        deletion_result = await user_service.request_deletion(session, user)

        assert deletion_result.deleted is True

        result = await session.execute(stmt)
        assert len(result.scalars().all()) == 0
