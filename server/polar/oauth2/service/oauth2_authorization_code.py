from sqlalchemy import select

from polar.enums import TokenType
from polar.kit.services import ResourceServiceReader
from polar.models import OAuth2AuthorizationCode
from polar.postgres import AsyncSession


class OAuth2AuthorizationCodeService(ResourceServiceReader[OAuth2AuthorizationCode]):
    async def revoke_leaked(
        self, session: AsyncSession, token: str, token_type: TokenType
    ) -> bool:
        statement = select(OAuth2AuthorizationCode).where(
            OAuth2AuthorizationCode.code == token
        )

        result = await session.execute(statement)
        authorization_code = result.scalar_one_or_none()

        if authorization_code is not None:
            authorization_code.set_deleted_at()
            session.add(authorization_code)
            return True

        return False


oauth2_authorization_code = OAuth2AuthorizationCodeService(OAuth2AuthorizationCode)
