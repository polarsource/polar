from uuid import UUID

import structlog
from sqlalchemy import func

from polar.account.service import account as account_service
from polar.authz.service import AccessType, Authz
from polar.enums import Platforms, UserSignupType
from polar.exceptions import PolarError, ResourceAlreadyExists, ResourceNotFound
from polar.integrations.loops.service import loops as loops_service
from polar.kit.services import ResourceService
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import Organization, User
from polar.organization.schemas import OrganizationCreate
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, sql
from polar.posthog import posthog
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.worker import enqueue_job

from .schemas import UserCreate, UserUpdate, UserUpdateSettings

log: Logger = structlog.get_logger()


class UserError(PolarError):
    ...


class InvalidAccount(UserError):
    def __init__(self, account_id: UUID) -> None:
        self.account_id = account_id
        message = (
            f"The account {account_id} does not exist "
            "or you don't have access to it."
        )
        super().__init__(message)


class UserService(ResourceService[User, UserCreate, UserUpdate]):
    async def get_loaded(self, session: AsyncSession, id: UUID) -> User | None:
        query = sql.select(User).where(
            User.id == id,
            User.deleted_at.is_(None),
        )
        res = await session.execute(query)
        return res.scalars().unique().one_or_none()

    async def create_personal_github_org(
        self,
        session: AsyncSession,
        user: User,
    ) -> Organization | None:
        current_user_org = await user_organization_service.get_users_personal_org(
            session,
            platform=Platforms.github,
            user_id=user.id,
        )
        if current_user_org:
            log.debug("user.create_github_org", found_existing=True)
            raise ResourceAlreadyExists("User already has a personal org")

        github_account = user.get_platform_oauth_account(Platforms.github)
        if not github_account:
            log.error(
                "user.create_github_org",
                error="No GitHub OAuth account found",
                user_id=user.id,
            )
            raise ResourceNotFound()

        # GitHub users cannot have an empty avatar_url, but needed for typing
        avatar_url = user.avatar_url
        if not avatar_url:
            avatar_url = ""

        new = OrganizationCreate(
            platform=Platforms.github,
            name=user.username,
            avatar_url=avatar_url,
            # Cast to GitHub ID (int)
            external_id=int(github_account.account_id),
            is_personal=True,
            # TODO: Should we really set this here?
            onboarded_at=utc_now(),
        )
        org = await organization_service.create(session, new)
        await organization_service.add_user(
            session, organization=org, user=user, is_admin=True
        )
        await enqueue_job("organization.post_user_upgrade", organization_id=org.id)
        return org

    async def get_by_email(self, session: AsyncSession, email: str) -> User | None:
        query = sql.select(User).where(
            func.lower(User.email) == email.lower(),
            User.deleted_at.is_(None),
        )
        res = await session.execute(query)
        return res.scalars().unique().one_or_none()

    async def get_by_username(
        self, session: AsyncSession, username: str
    ) -> User | None:
        query = sql.select(User).where(
            User.username == username,
            User.deleted_at.is_(None),
        )
        res = await session.execute(query)
        return res.scalars().unique().one_or_none()

    async def get_by_stripe_customer_id(
        self, session: AsyncSession, stripe_customer_id: str
    ) -> User | None:
        query = sql.select(User).where(
            User.stripe_customer_id == stripe_customer_id,
            User.deleted_at.is_(None),
        )
        res = await session.execute(query)
        return res.scalars().unique().one_or_none()

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
        posthog.user_event(user, "User Signed Up")
        log.info("user signed up by email", user_id=user.id, email=email)

        return user

    async def update_preferences(
        self, session: AsyncSession, user: User, settings: UserUpdateSettings
    ) -> User:
        changed = False

        if settings.email_newsletters_and_changelogs is not None:
            user.email_newsletters_and_changelogs = (
                settings.email_newsletters_and_changelogs
            )
            changed = True

        if settings.email_promotions_and_events is not None:
            user.email_promotions_and_events = settings.email_promotions_and_events
            changed = True

        if changed:
            await user.save(session)

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
