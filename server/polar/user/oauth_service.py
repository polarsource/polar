import structlog
from sqlalchemy import func, select

from polar.exceptions import PolarError
from polar.kit.services import ResourceServiceReader
from polar.logging import Logger
from polar.models import OAuthAccount, User
from polar.models.user import OAuthPlatform
from polar.postgres import AsyncSession

log: Logger = structlog.get_logger()


class OAuthError(PolarError): ...


class OAuthAccountNotFound(OAuthError):
    def __init__(self, platform: OAuthPlatform) -> None:
        self.platform = platform
        message = f"No {platform} OAuth account found for this user."
        super().__init__(message, 404)


class CannotDisconnectLastAuthMethod(OAuthError):
    def __init__(self) -> None:
        message = (
            "Cannot disconnect this OAuth account as it's your only authentication method. "
            "Please verify your email or connect another OAuth provider before disconnecting."
        )
        super().__init__(message, 400)


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

    async def disconnect_platform(
        self, session: AsyncSession, user: User, platform: OAuthPlatform
    ) -> None:
        oauth_accounts_statement = select(OAuthAccount).where(
            OAuthAccount.platform == platform,
            OAuthAccount.user_id == user.id,
        )
        oauth_account_result = await session.execute(oauth_accounts_statement)
        # Some users have a buggy state with multiple OAuth accounts for the same platform
        oauth_accounts = oauth_account_result.scalars().all()

        if len(oauth_accounts) == 0:
            raise OAuthAccountNotFound(platform)

        other_accounts_count_statement = select(func.count(OAuthAccount.id)).where(
            OAuthAccount.user_id == user.id,
            OAuthAccount.id.not_in([oa.id for oa in oauth_accounts]),
        )
        other_accounts_count_result = await session.execute(
            other_accounts_count_statement
        )
        other_accounts_count = other_accounts_count_result.scalar_one()

        if other_accounts_count == 0 and not user.email_verified:
            raise CannotDisconnectLastAuthMethod()

        for oauth_account in oauth_accounts:
            await session.delete(oauth_account)
            log.info(
                "oauth_account.disconnect",
                oauth_account_id=oauth_account.id,
                platform=platform,
            )

        await session.flush()


oauth_account_service = OAuthAccountService(OAuthAccount)
