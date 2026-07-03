import time
from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import delete, or_, select, update

from polar.kit.repository import RepositoryBase
from polar.models import OAuth2Token, OAuth2TokenOrganization


class OAuth2TokenRepository(RepositoryBase[OAuth2Token]):
    model = OAuth2Token

    async def revoke_scoped_to_organization(self, organization_id: UUID) -> None:
        """Revoke tokens explicitly down-scoped to an organization."""
        now = int(time.time())
        scoped_token_ids = (
            select(OAuth2TokenOrganization.oauth2_token_id)
            .where(OAuth2TokenOrganization.organization_id == organization_id)
            .scalar_subquery()
        )
        statement = (
            update(OAuth2Token)
            .where(
                OAuth2Token.id.in_(scoped_token_ids),
                or_(
                    OAuth2Token.access_token_revoked_at == 0,
                    OAuth2Token.refresh_token_revoked_at == 0,
                ),
            )
            .values(access_token_revoked_at=now, refresh_token_revoked_at=now)
        )
        await self.session.execute(statement)

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
