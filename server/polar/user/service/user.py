from uuid import UUID

import structlog
from sqlalchemy import func

from polar.account.service import account as account_service
from polar.authz.service import AccessType, Authz
from polar.enums import UserSignupType
from polar.exceptions import PolarError
from polar.integrations.loops.service import loops as loops_service
from polar.kit.services import ResourceService
from polar.logging import Logger
from polar.models import OAuthAccount, User
from polar.models.user import OAuthPlatform
from polar.postgres import AsyncSession, sql
from polar.posthog import posthog

from ..schemas.user import UserCreate, UserUpdate

log: Logger = structlog.get_logger()


class UserError(PolarError): ...


class InvalidAccount(UserError):
    def __init__(self, account_id: UUID) -> None:
        self.account_id = account_id
        message = (
            f"The account {account_id} does not exist "
            "or you don't have access to it."
        )
        super().__init__(message)


class UserService(ResourceService[User, UserCreate, UserUpdate]):
    async def get_by_email(self, session: AsyncSession, email: str) -> User | None:
        query = sql.select(User).where(
            func.lower(User.email) == email.lower(),
            User.deleted_at.is_(None),
            User.blocked_at.is_(None),
        )
        res = await session.execute(query)
        return res.scalars().unique().one_or_none()

    async def get_by_username(
        self, session: AsyncSession, username: str
    ) -> User | None:
        query = sql.select(User).where(
            User.username == username,
            User.deleted_at.is_(None),
            User.blocked_at.is_(None),
        )
        res = await session.execute(query)
        return res.scalars().unique().one_or_none()

    async def get_by_stripe_customer_id(
        self, session: AsyncSession, stripe_customer_id: str
    ) -> User | None:
        query = sql.select(User).where(
            User.stripe_customer_id == stripe_customer_id,
            User.deleted_at.is_(None),
            User.blocked_at.is_(None),
        )
        res = await session.execute(query)
        return res.scalars().unique().one_or_none()

    async def get_by_oauth_account(
        self, session: AsyncSession, platform: OAuthPlatform, account_id: str
    ) -> User | None:
        statement = (
            sql.select(User)
            .join(User.oauth_accounts)
            .where(
                User.deleted_at.is_(None),
                User.blocked_at.is_(None),
                OAuthAccount.deleted_at.is_(None),
                OAuthAccount.platform == platform,
                OAuthAccount.account_id == account_id,
            )
        )
        result = await session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def get_by_email_or_signup(
        self,
        session: AsyncSession,
        email: str,
        *,
        signup_type: UserSignupType | None = None,
    ) -> User:
        user = await self.get_by_email(session, email)
        signup = False
        if user is None:
            user = await self.signup_by_email(session, email)
            signup = True

        if signup:
            await loops_service.user_signup(user, signup_type)
        else:
            await loops_service.user_update(user)
        return user

    async def signup_by_email(self, session: AsyncSession, email: str) -> User:
        user = User(username=email, email=email, oauth_accounts=[])
        session.add(user)
        await session.commit()

        posthog.identify(user)
        posthog.user_event(user, "user", "signed_up", "done")
        log.info("user signed up by email", user_id=user.id, email=email)

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
        await session.commit()
        return user


user = UserService(User)
