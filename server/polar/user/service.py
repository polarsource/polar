from uuid import UUID

from polar.account.service import account as account_service
from polar.authz.service import AccessType, Authz
from polar.exceptions import PolarError
from polar.models import User
from polar.postgres import AsyncSession
from polar.worker import enqueue_job

from .repository import UserRepository
from .schemas import UserSignupAttribution


class UserError(PolarError): ...


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
