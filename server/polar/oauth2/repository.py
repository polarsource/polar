import time
from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import delete, or_

from polar.kit.repository import RepositoryBase
from polar.models import OAuth2Token, OAuth2TokenOrganization


class OAuth2TokenRepository(RepositoryBase[OAuth2Token]):
    model = OAuth2Token

    async def get_scoped_to_organization(
        self, organization_id: UUID
    ) -> Sequence[OAuth2Token]:
        """Live (non-revoked) tokens explicitly down-scoped to an organization."""
        statement = (
            self.get_base_statement()
            .join(
                OAuth2TokenOrganization,
                OAuth2TokenOrganization.oauth2_token_id == OAuth2Token.id,
            )
            .where(
                OAuth2TokenOrganization.organization_id == organization_id,
                OAuth2Token.access_token_revoked_at == 0,
            )
        )
        return await self.get_all(statement)

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
