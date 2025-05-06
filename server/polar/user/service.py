from uuid import UUID

import stripe as stripe_lib

from polar.account.service import account as account_service
from polar.authz.service import AccessType, Authz
from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.models import User
from polar.models.user import IdentityVerificationStatus
from polar.postgres import AsyncSession
from polar.worker import enqueue_job

from .repository import UserRepository
from .schemas import UserIdentityVerification, UserSignupAttribution


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

    async def set_account(
        self, session: AsyncSession, *, authz: Authz, user: User, account_id: UUID
    ) -> User:
        account = await account_service.get_by_id(session, account_id)
        if account is None:
            raise InvalidAccount(account_id)
        if not await authz.can(user, AccessType.write, account):
            raise InvalidAccount(account_id)

        user.account = account
        session.add(user)
        return user


user = UserService()
