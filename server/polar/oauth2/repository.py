import time
from collections.abc import Sequence

from sqlalchemy import delete, or_

from polar.kit.repository import RepositoryBase
from polar.models import OAuth2Token


class OAuth2TokenRepository(RepositoryBase[OAuth2Token]):
    model = OAuth2Token

    async def delete_expired(self, *, exclude_client_ids: Sequence[str] = ()) -> None:
        now = int(time.time())
        statement = delete(OAuth2Token).where(
            OAuth2Token.issued_at + OAuth2Token.expires_in < now,
            or_(
                OAuth2Token.refresh_token.is_(None),
                OAuth2Token.refresh_token_revoked_at != 0,
            ),
        )
        if exclude_client_ids:
            statement = statement.where(
                OAuth2Token.client_id.notin_(exclude_client_ids)
            )
        await self.session.execute(statement)
