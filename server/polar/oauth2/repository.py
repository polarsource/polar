import time
from uuid import UUID

from sqlalchemy import delete, or_, select, update
from sqlalchemy.orm import joinedload

from polar.enums import TokenType
from polar.kit.crypto import get_token_hash_candidates
from polar.kit.repository import RepositoryBase, RepositoryTokenHashMixin
from polar.models import OAuth2AuthorizationCode, OAuth2Token, OAuth2TokenOrganization


class OAuth2TokenRepository(
    RepositoryTokenHashMixin[OAuth2Token],
    RepositoryBase[OAuth2Token],
):
    model = OAuth2Token
    token_hash_attribute = "access_token"

    async def get_by_access_token(self, access_token: str) -> OAuth2Token | None:
        statement = (
            self.get_base_statement()
            .where(self.token_hash_clause(get_token_hash_candidates(access_token)))
            .options(joinedload(OAuth2Token.client))
        )
        return await self.get_one_or_none(statement)

    async def get_by_leaked_token(
        self, token: str, token_type: TokenType
    ) -> OAuth2Token | None:
        statement = self.get_base_statement().options(
            joinedload(OAuth2Token.user),
            joinedload(OAuth2Token.organization),
            joinedload(OAuth2Token.client),
        )
        candidates = get_token_hash_candidates(token)
        if token_type == TokenType.access_token:
            statement = statement.where(self.token_hash_clause(candidates))
        elif token_type == TokenType.refresh_token:
            statement = statement.where(
                self.token_hash_clause(candidates, attribute="refresh_token")
            )
        else:
            raise ValueError(f"Unsupported token type: {token_type}")
        return await self.get_one_or_none(statement)

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

    async def delete_expired(self) -> None:
        now = int(time.time())
        statement = delete(OAuth2Token).where(
            OAuth2Token.issued_at + OAuth2Token.expires_in < now,
            or_(
                OAuth2Token.refresh_token.is_(None),
                OAuth2Token.refresh_token_revoked_at != 0,
            ),
        )
        await self.session.execute(statement)


class OAuth2AuthorizationCodeRepository(
    RepositoryTokenHashMixin[OAuth2AuthorizationCode],
    RepositoryBase[OAuth2AuthorizationCode],
):
    model = OAuth2AuthorizationCode
    token_hash_attribute = "code"

    async def get_by_code(self, code: str) -> OAuth2AuthorizationCode | None:
        statement = self.get_base_statement().where(
            self.token_hash_clause(get_token_hash_candidates(code))
        )
        return await self.get_one_or_none(statement)
