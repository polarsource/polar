from uuid import UUID

import structlog
from sqlalchemy import func

from polar.account.service import account as account_service
from polar.authz.service import AccessType, Authz
from polar.exceptions import PolarError
from polar.kit.services import ResourceService
from polar.logging import Logger
from polar.models import OAuthAccount, User
from polar.models.user import OAuthPlatform
from polar.postgres import AsyncSession, sql
from polar.user.schemas.user import UserSignupAttribution
from polar.worker import enqueue_job

from ..schemas.user import UserCreate, UserUpdate

log: Logger = structlog.get_logger()


class UserError(PolarError): ...


class InvalidAccount(UserError):
    def __init__(self, account_id: UUID) -> None:
        self.account_id = account_id
        message = (
            f"The account {account_id} does not exist or you don't have access to it."
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

    async def get_by_email_or_create(
        self,
        session: AsyncSession,
        email: str,
        *,
        signup_attribution: UserSignupAttribution | None = None,
    ) -> tuple[User, bool]:
        user = await self.get_by_email(session, email)
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
        user = User(
            email=email,
            oauth_accounts=[],
            signup_attribution=signup_attribution,
        )

        session.add(user)
        await session.flush()

        log.info("user.create", user_id=user.id, email=email)

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


user = UserService(User)
