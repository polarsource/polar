import structlog
from sqlalchemy import select

from polar.enums import TokenType
from polar.kit.services import ResourceServiceReader
from polar.kit.token_hash import hash_token
from polar.logging import Logger
from polar.models import OAuth2AuthorizationCode
from polar.postgres import AsyncSession

log: Logger = structlog.get_logger()


class OAuth2AuthorizationCodeService(ResourceServiceReader[OAuth2AuthorizationCode]):
    async def revoke_leaked(
        self,
        session: AsyncSession,
        token: str,
        token_type: TokenType,
        *,
        notifier: str,
        url: str | None = None,
    ) -> bool:
        statement = select(OAuth2AuthorizationCode).where(
            OAuth2AuthorizationCode.code == hash_token(token)
        )

        result = await session.execute(statement)
        authorization_code = result.unique().scalar_one_or_none()

        if authorization_code is None:
            return False

        authorization_code.set_deleted_at()
        session.add(authorization_code)

        log.info(
            "Revoke leaked authorization code",
            id=authorization_code.id,
            notifier=notifier,
            url=url,
        )

        return True


oauth2_authorization_code = OAuth2AuthorizationCodeService(OAuth2AuthorizationCode)
