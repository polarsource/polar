from uuid import UUID

import structlog
from sqlalchemy import delete, func, select

from polar.kit.services import ResourceServiceReader
from polar.logging import Logger
from polar.models import OAuthAccount, User
from polar.models.user import OAuthPlatform
from polar.postgres import AsyncSession

log: Logger = structlog.get_logger()


class OAuthAccountService(ResourceServiceReader[OAuthAccount]):
    async def get_by_platform_and_account_id(
        self, session: AsyncSession, platform: OAuthPlatform, account_id: str
    ) -> OAuthAccount | None:
        stmt = select(OAuthAccount).where(
            OAuthAccount.platform == platform,
            OAuthAccount.account_id == account_id,
        )
        result = await session.execute(stmt)
        return result.scalars().one_or_none()

    async def get_by_platform_and_user_id(
        self, session: AsyncSession, platform: OAuthPlatform, user_id: UUID
    ) -> OAuthAccount | None:
        stmt = select(OAuthAccount).where(
            OAuthAccount.platform == platform,
            OAuthAccount.user_id == user_id,
        )
        result = await session.execute(stmt)
        return result.scalars().one_or_none()

    async def can_disconnect_oauth_account(
        self, session: AsyncSession, user: User, oauth_account_id: UUID
    ) -> bool:
        stmt = select(func.count(OAuthAccount.id)).where(
            OAuthAccount.user_id == user.id,
            OAuthAccount.id != oauth_account_id,
        )
        active_oauth_count = await session.scalar(stmt)

        if active_oauth_count == 0 and not user.email_verified:
            return False

        return True

    async def disconnect_oauth_account(
        self,
        session: AsyncSession,
        user: User,
        oauth_account_id: UUID,
        platform: OAuthPlatform,
    ) -> None:
        log.info(
            "oauth_account.disconnect",
            oauth_account_id=oauth_account_id,
            platform=platform,
        )
        stmt = delete(OAuthAccount).where(OAuthAccount.id == oauth_account_id)
        await session.execute(stmt)
        await session.flush()


oauth_account_service = OAuthAccountService(OAuthAccount)
