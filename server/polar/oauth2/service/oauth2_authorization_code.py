from sqlalchemy import select

from polar.config import settings
from polar.enums import TokenType
from polar.kit.crypto import get_token_hash
from polar.kit.services import ResourceServiceReader
from polar.models import OAuth2AuthorizationCode
from polar.postgres import AsyncSession


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
            OAuth2AuthorizationCode.code
            == get_token_hash(token, secret=settings.SECRET)
        )

        result = await session.execute(statement)
        authorization_code = result.unique().scalar_one_or_none()

        if authorization_code is None:
            return False

        authorization_code.set_deleted_at()
        session.add(authorization_code)
        return True


oauth2_authorization_code = OAuth2AuthorizationCodeService(OAuth2AuthorizationCode)
