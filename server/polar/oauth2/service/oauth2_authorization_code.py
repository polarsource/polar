import structlog

from polar.enums import TokenType
from polar.kit.services import ResourceServiceReader
from polar.logging import Logger
from polar.models import OAuth2AuthorizationCode
from polar.oauth2.repository import OAuth2AuthorizationCodeRepository
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
        repository = OAuth2AuthorizationCodeRepository.from_session(session)
        authorization_code = await repository.get_by_code(token)

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
