import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.kit.utils import utc_now
from polar.models import (
    NotificationRecipient,
    OAuthAccount,
    Organization,
    User,
    UserOrganization,
)
from polar.models.user import IdentityVerificationStatus, OAuthPlatform
from polar.models.user_organization import OrganizationRole
from polar.postgres import AsyncSession
from polar.user.schemas import UserDeletionBlockedReason, UserUpdate
from polar.user.service import user as user_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_notification_recipient,
    create_oauth_account,
    create_payout_account,
)


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
class TestUpdate:
    async def test_enqueues_member_name_update_when_name_changes(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        user.first_name = "Old"
        user.last_name = "Name"
        await save_fixture(user)

        enqueue_mock = mocker.patch(
            "polar.user.service.polar_self_service.enqueue_update_member"
        )

        await user_service.update(
            session, user, UserUpdate(first_name="New", last_name="Name")
        )

        enqueue_mock.assert_called_once_with(
            external_customer_id=str(organization.id),
            external_id=str(user.id),
            name="New Name",
        )

    async def test_skips_when_name_cleared(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        user.first_name = "Old"
        user.last_name = "Name"
        await save_fixture(user)

        enqueue_mock = mocker.patch(
            "polar.user.service.polar_self_service.enqueue_update_member"
        )

        await user_service.update(
            session, user, UserUpdate(first_name=None, last_name=None)
        )

        enqueue_mock.assert_not_called()

    async def test_skips_when_name_unchanged(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        user.first_name = "Same"
        user.last_name = "Name"
        await save_fixture(user)

        enqueue_mock = mocker.patch(
            "polar.user.service.polar_self_service.enqueue_update_member"
        )

        await user_service.update(
            session, user, UserUpdate(first_name="Same", last_name="Name")
        )

        enqueue_mock.assert_not_called()


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
        assert user.email.endswith("@anonymized.polar.sh")

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
        assert user.email.endswith("@anonymized.polar.sh")
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

    async def test_notification_recipients_deleted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
    ) -> None:
        """Notification recipients are soft-deleted when user is deleted."""
        await create_notification_recipient(
            save_fixture, user=user, expo_push_token="ExponentPushToken[token1]"
        )
        await create_notification_recipient(
            save_fixture, user=user, expo_push_token="ExponentPushToken[token2]"
        )

        stmt = select(NotificationRecipient).where(
            NotificationRecipient.user_id == user.id,
            NotificationRecipient.deleted_at.is_(None),
        )
        result = await session.execute(stmt)
        assert len(result.scalars().all()) == 2

        deletion_result = await user_service.request_deletion(session, user)

        assert deletion_result.deleted is True

        result = await session.execute(stmt)
        assert len(result.scalars().all()) == 0

        stmt_all = select(NotificationRecipient).where(
            NotificationRecipient.user_id == user.id,
        )
        result = await session.execute(stmt_all)
        recipients = result.scalars().all()
        assert len(recipients) == 2
        assert all(r.deleted_at is not None for r in recipients)


@pytest.mark.asyncio
class TestIdentityVerificationVerified:
    async def test_activates_organizations_owned_by_user(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        """The webhook activates orgs where the verified user is the owner,
        not orgs where they are merely the (static) payout account admin.
        """
        user.identity_verification_id = "vs_owner_test"
        await save_fixture(user)

        # User owns `organization`.
        await save_fixture(
            UserOrganization(
                user_id=user.id,
                organization_id=organization.id,
                role=OrganizationRole.owner,
            )
        )

        # User is only the payout account admin of `organization_second`
        # (not the owner) — the old behavior would have tried to activate it.
        await save_fixture(
            UserOrganization(
                user_id=user.id,
                organization_id=organization_second.id,
                role=OrganizationRole.member,
            )
        )
        await create_payout_account(save_fixture, organization_second, user)

        maybe_activate_mock = mocker.patch(
            "polar.user.service.organization_service.maybe_activate",
            new_callable=mocker.AsyncMock,
        )

        verification_session = stripe_lib.identity.VerificationSession.construct_from(
            {"id": "vs_owner_test", "status": "verified"}, None
        )

        updated_user = await user_service.identity_verification_verified(
            session, verification_session
        )

        assert (
            updated_user.identity_verification_status
            == IdentityVerificationStatus.verified
        )

        activated_org_ids = {
            call.args[1].id for call in maybe_activate_mock.call_args_list
        }
        assert organization.id in activated_org_ids
        assert organization_second.id not in activated_org_ids


@pytest.mark.asyncio
class TestIdentityVerificationPending:
    async def test_sets_pending_from_unverified(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        user.identity_verification_id = "vs_pending_test"
        user.identity_verification_status = IdentityVerificationStatus.unverified
        await save_fixture(user)

        verification_session = stripe_lib.identity.VerificationSession.construct_from(
            {"id": "vs_pending_test", "status": "processing"}, None
        )

        updated_user = await user_service.identity_verification_pending(
            session, verification_session
        )

        assert (
            updated_user.identity_verification_status
            == IdentityVerificationStatus.pending
        )

    async def test_does_not_downgrade_verified(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        """A `processing` webhook must never clobber a `verified` status.

        Stripe delivers `processing` and `verified` back to back and the two
        webhook tasks can run concurrently; if `processing` wins the race it
        would strand a genuinely-verified user in `pending` (see T-30664).
        """
        user.identity_verification_id = "vs_verified_race"
        user.identity_verification_status = IdentityVerificationStatus.verified
        await save_fixture(user)

        verification_session = stripe_lib.identity.VerificationSession.construct_from(
            {"id": "vs_verified_race", "status": "processing"}, None
        )

        updated_user = await user_service.identity_verification_pending(
            session, verification_session
        )

        assert (
            updated_user.identity_verification_status
            == IdentityVerificationStatus.verified
        )

    async def test_does_not_downgrade_failed(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        user.identity_verification_id = "vs_failed_race"
        user.identity_verification_status = IdentityVerificationStatus.failed
        await save_fixture(user)

        verification_session = stripe_lib.identity.VerificationSession.construct_from(
            {"id": "vs_failed_race", "status": "processing"}, None
        )

        updated_user = await user_service.identity_verification_pending(
            session, verification_session
        )

        assert (
            updated_user.identity_verification_status
            == IdentityVerificationStatus.failed
        )
