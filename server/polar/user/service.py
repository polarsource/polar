import structlog
from sqlalchemy import func

from polar.enums import Platforms
from polar.kit.services import ResourceService, ResourceServiceReader
from polar.logging import Logger
from polar.models import OAuthAccount, User
from polar.postgres import AsyncSession, sql
from polar.posthog import posthog

from .schemas import UserCreate, UserUpdate, UserUpdateSettings

log: Logger = structlog.get_logger()


class UserService(ResourceService[User, UserCreate, UserUpdate]):
    async def get_by_email(self, session: AsyncSession, email: str) -> User | None:
        query = sql.select(self.model).where(func.lower(User.email) == email.lower())
        res = await session.execute(query)
        return res.scalars().unique().one_or_none()

    async def signup_by_email(self, session: AsyncSession, email: str) -> User:
        user = await self.get_by_email(session, email)

        if user is None:
            user = User(username=email, email=email)
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


user = UserService(User)


class OAuthAccountService(ResourceServiceReader[OAuthAccount]):
    async def get_by_platform_and_account_id(
        self, session: AsyncSession, platform: Platforms, account_id: str
    ) -> OAuthAccount | None:
        return await self.get_by(session, platform=platform, account_id=account_id)


oauth_account = OAuthAccountService(OAuthAccount)
