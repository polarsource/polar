from typing import Any
from uuid import UUID

import stripe as stripe_lib
import structlog
from sqlalchemy import delete

from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.anonymization import anonymize_email_for_deletion
from polar.models import OAuthAccount, User
from polar.models.user import IdentityVerificationStatus
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession
from polar.worker import enqueue_job

from .repository import UserRepository
from .schemas import (
    BlockingOrganization,
    UserDeletionBlockedReason,
    UserDeletionResponse,
    UserIdentityVerification,
    UserSignupAttribution,
)

log = structlog.get_logger()


class UserError(PolarError): ...


class IdentityAlreadyVerified(UserError):
    def __init__(self, user_id: UUID) -> None:
        self.user_id = user_id
        message = "Your identity is already verified."
        super().__init__(message, 403)


class IdentityVerificationProcessing(UserError):
    def __init__(self, user_id: UUID) -> None:
        self.user_id = user_id
        message = "Your identity verification is still processing."
        super().__init__(message, 403)


class IdentityVerificationDoesNotExist(UserError):
    def __init__(self, identity_verification_id: str) -> None:
        self.identity_verification_id = identity_verification_id
        message = (
            f"Received identity verification {identity_verification_id} from Stripe, "
            "but no associated User exists."
        )
        super().__init__(message)


class InvalidAccount(UserError):
    def __init__(self, account_id: UUID) -> None:
        self.account_id = account_id
        message = (
            f"The account {account_id} does not exist or you don't have access to it."
        )
        super().__init__(message)


class UserService:
    async def get_by_email_or_create(
        self,
        session: AsyncSession,
        email: str,
        *,
        signup_attribution: UserSignupAttribution | None = None,
    ) -> tuple[User, bool]:
        repository = UserRepository.from_session(session)
        user = await repository.get_by_email(email)
        created = False
        if user is None:
            user = await self.create_by_email(
                session, email, signup_attribution=signup_attribution
            )
            created = True

        return (user, created)

    async def create_by_email(
        self,
        session: AsyncSession,
        email: str,
        signup_attribution: UserSignupAttribution | None = None,
    ) -> User:
        repository = UserRepository.from_session(session)
        user = await repository.create(
            User(
                email=email,
                oauth_accounts=[],
                signup_attribution=signup_attribution,
            ),
            flush=True,
        )
        enqueue_job("user.on_after_signup", user_id=user.id)
        return user

    async def create_identity_verification(
        self, session: AsyncSession, user: User
    ) -> UserIdentityVerification:
        if user.identity_verified:
            raise IdentityAlreadyVerified(user.id)

        if user.identity_verification_status == IdentityVerificationStatus.pending:
            raise IdentityVerificationProcessing(user.id)

        verification_session: stripe_lib.identity.VerificationSession | None = None
        if user.identity_verification_id is not None:
            verification_session = await stripe_service.get_verification_session(
                user.identity_verification_id
            )

        if (
            verification_session is None
            or verification_session.status != "requires_input"
        ):
            verification_session = await stripe_service.create_verification_session(
                user
            )

        repository = UserRepository.from_session(session)
        await repository.update(
            user, update_dict={"identity_verification_id": verification_session.id}
        )

        assert verification_session.client_secret is not None
        return UserIdentityVerification(
            id=verification_session.id, client_secret=verification_session.client_secret
        )

    async def identity_verification_verified(
        self,
        session: AsyncSession,
        verification_session: stripe_lib.identity.VerificationSession,
    ) -> User:
        repository = UserRepository.from_session(session)
        user = await repository.get_by_identity_verification_id(verification_session.id)
        if user is None:
            raise IdentityVerificationDoesNotExist(verification_session.id)

        assert verification_session.status == "verified"
        return await repository.update(
            user,
            update_dict={
                "identity_verification_status": IdentityVerificationStatus.verified
            },
        )

    async def identity_verification_pending(
        self,
        session: AsyncSession,
        verification_session: stripe_lib.identity.VerificationSession,
    ) -> User:
        repository = UserRepository.from_session(session)
        user = await repository.get_by_identity_verification_id(verification_session.id)
        if user is None:
            raise IdentityVerificationDoesNotExist(verification_session.id)

        # If the user is already verified, we don't need to update their status.
        # Might happen if the webhook was delayed
        if user.identity_verified:
            return user

        assert verification_session.status == "processing"
        return await repository.update(
            user,
            update_dict={
                "identity_verification_status": IdentityVerificationStatus.pending
            },
        )

    async def identity_verification_failed(
        self,
        session: AsyncSession,
        verification_session: stripe_lib.identity.VerificationSession,
    ) -> User:
        repository = UserRepository.from_session(session)
        user = await repository.get_by_identity_verification_id(verification_session.id)
        if user is None:
            raise IdentityVerificationDoesNotExist(verification_session.id)

        # TODO: should we send an email?

        return await repository.update(
            user,
            update_dict={
                "identity_verification_status": IdentityVerificationStatus.failed
            },
        )

    async def delete_identity_verification(
        self, session: AsyncSession, user: User
    ) -> User:
        """Delete identity verification for a user.

        Resets the user's identity verification status to unverified and
        redacts the verification session in Stripe.
        """
        repository = UserRepository.from_session(session)

        if user.identity_verification_id is not None:
            try:
                await stripe_service.redact_verification_session(
                    user.identity_verification_id
                )
            except stripe_lib.InvalidRequestError as e:
                log.warning(
                    "stripe.identity.verification_session.redact.not_found",
                    identity_verification_id=user.identity_verification_id,
                    error=str(e),
                )

        return await repository.update(
            user,
            update_dict={
                "identity_verification_status": IdentityVerificationStatus.unverified,
                "identity_verification_id": None,
            },
        )

    async def check_can_delete(
        self,
        session: AsyncSession,
        user: User,
    ) -> UserDeletionResponse:
        """Check if a user can be deleted.

        A user can be deleted if all organizations they are members of
        are soft-deleted (deleted_at is not None).
        """
        blocked_reasons: list[UserDeletionBlockedReason] = []
        blocking_organizations: list[BlockingOrganization] = []

        # Get all organizations the user is a member of (excluding deleted orgs)
        org_repository = OrganizationRepository.from_session(session)
        organizations = await org_repository.get_all_by_user(user.id)

        if organizations:
            blocked_reasons.append(UserDeletionBlockedReason.HAS_ACTIVE_ORGANIZATIONS)
            for org in organizations:
                blocking_organizations.append(
                    BlockingOrganization(id=org.id, slug=org.slug, name=org.name)
                )

        return UserDeletionResponse(
            deleted=False,
            blocked_reasons=blocked_reasons,
            blocking_organizations=blocking_organizations,
        )

    async def request_deletion(
        self,
        session: AsyncSession,
        user: User,
    ) -> UserDeletionResponse:
        """Request deletion of the user account.

        Flow:
        1. Check if user has any active organizations -> block if yes
        2. Soft delete the user

        Note: The user's Account (payout account) is not deleted here.
        Accounts are tied to organizations and should be deleted when the
        organization is deleted, not when the user account is deleted.
        """
        check_result = await self.check_can_delete(session, user)

        if check_result.blocked_reasons:
            return check_result

        # Soft delete the user
        await self.soft_delete_user(session, user)

        return UserDeletionResponse(
            deleted=True,
            blocked_reasons=[],
            blocking_organizations=[],
        )

    async def soft_delete_user(
        self,
        session: AsyncSession,
        user: User,
    ) -> User:
        """Soft-delete a user, anonymizing PII fields."""
        repository = UserRepository.from_session(session)

        update_dict: dict[str, Any] = {}

        update_dict["email"] = anonymize_email_for_deletion(user.email)

        if user.avatar_url:
            update_dict["avatar_url"] = None

        if user.meta:
            update_dict["meta"] = {}

        await self._delete_oauth_accounts(session, user)

        user = await repository.update(user, update_dict=update_dict)
        await repository.soft_delete(user)

        log.info(
            "user.deleted",
            user_id=user.id,
        )

        return user

    async def _delete_oauth_accounts(
        self,
        session: AsyncSession,
        user: User,
    ) -> None:
        """Delete all OAuth accounts for a user."""
        stmt = delete(OAuthAccount).where(OAuthAccount.user_id == user.id)
        await session.execute(stmt)

        log.info(
            "user.oauth_accounts_deleted",
            user_id=user.id,
        )


user = UserService()
