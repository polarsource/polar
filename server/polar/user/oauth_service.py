from uuid import UUID

import structlog

from polar.enums import Platforms
from polar.kit.services import ResourceServiceReader
from polar.logging import Logger
from polar.models import OAuthAccount
from polar.postgres import AsyncSession

log: Logger = structlog.get_logger()


class OAuthAccountService(ResourceServiceReader[OAuthAccount]):
    async def get_by_platform_and_account_id(
        self, session: AsyncSession, platform: Platforms, account_id: str
    ) -> OAuthAccount | None:
        return await self.get_by(session, platform=platform, account_id=account_id)

    async def get_by_platform_and_user_id(
        self, session: AsyncSession, platform: Platforms, user_id: UUID
    ) -> OAuthAccount | None:
        return await self.get_by(session, platform=platform, user_id=user_id)


oauth_account_service = OAuthAccountService(OAuthAccount)
