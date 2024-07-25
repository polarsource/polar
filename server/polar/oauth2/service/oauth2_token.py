import time
from typing import cast

from sqlalchemy import select

from polar.config import settings
from polar.enums import TokenType
from polar.exceptions import PolarError
from polar.kit.crypto import get_token_hash
from polar.kit.services import ResourceServiceReader
from polar.models import OAuth2Token
from polar.postgres import AsyncSession


class OAuth2TokenError(PolarError): ...


class OAuth2TokenService(ResourceServiceReader[OAuth2Token]):
    async def get_by_access_token(
        self, session: AsyncSession, access_token: str
    ) -> OAuth2Token | None:
        access_token_hash = get_token_hash(access_token, secret=settings.SECRET)
        statement = select(OAuth2Token).where(
            OAuth2Token.access_token == access_token_hash
        )
        result = await session.execute(statement)
        token = result.unique().scalar_one_or_none()
        if token is not None and not cast(bool, token.is_revoked()):
            return token
        return None

    async def revoke_leaked(
        self, session: AsyncSession, token: str, token_type: TokenType
    ) -> bool:
        statement = select(OAuth2Token)

        if token_type == TokenType.access_token:
            statement = statement.where(
                OAuth2Token.access_token
                == get_token_hash(token, secret=settings.SECRET)
            )
        elif token_type == TokenType.refresh_token:
            statement = statement.where(
                OAuth2Token.refresh_token
                == get_token_hash(token, secret=settings.SECRET)
            )
        else:
            raise ValueError(f"Unsupported token type: {token_type}")

        result = await session.execute(statement)
        oauth2_token = result.scalar_one_or_none()
        if oauth2_token is not None:
            oauth2_token.access_token_revoked_at = int(time.time())  # type: ignore
            oauth2_token.refresh_token_revoked_at = int(time.time())  # type: ignore
            session.add(oauth2_token)

            # TODO: notify user
            return True

        return False


oauth2_token = OAuth2TokenService(OAuth2Token)
