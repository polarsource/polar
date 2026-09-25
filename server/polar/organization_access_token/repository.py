from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, or_, update
from sqlalchemy.orm import contains_eager

from polar.authz.types import AccessibleOrganizationID
from polar.kit.crypto import get_token_hash_candidates
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositoryTokenHashMixin,
)
from polar.kit.utils import utc_now
from polar.models import Organization, OrganizationAccessToken
from polar.postgres import sql


class OrganizationAccessTokenRepository(
    RepositorySoftDeletionIDMixin[OrganizationAccessToken, UUID],
    RepositorySoftDeletionMixin[OrganizationAccessToken],
    RepositoryTokenHashMixin[OrganizationAccessToken],
    RepositoryBase[OrganizationAccessToken],
):
    model = OrganizationAccessToken
    token_hash_attribute = "token"

    async def get_by_token(
        self,
        token: str,
        *,
        expired: bool = False,
        include_deleted: bool = False,
        include_blocked: bool = False,
    ) -> OrganizationAccessToken | None:
        candidates = get_token_hash_candidates(token)
        statement = (
            self.get_base_statement()
            .join(OrganizationAccessToken.organization)
            .where(self.token_hash_clause(candidates))
            .options(contains_eager(OrganizationAccessToken.organization))
        )
        if not include_deleted:
            statement = statement.where(~Organization.is_deleted)
        if not include_blocked:
            statement = statement.where(
                Organization.capabilities["api_access"].as_boolean()
            )
        if not expired:
            statement = statement.where(
                or_(
                    OrganizationAccessToken.expires_at.is_(None),
                    OrganizationAccessToken.expires_at > utc_now(),
                )
            )
        organization_access_token = await self.get_one_or_none(statement)
        if organization_access_token is None:
            return None
        return await self.rehash_token(organization_access_token, candidates)

    async def record_usage(self, id: UUID, last_used_at: datetime) -> None:
        statement = (
            update(OrganizationAccessToken)
            .where(OrganizationAccessToken.id == id)
            .values(last_used_at=last_used_at)
        )
        await self.session.execute(statement)

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[OrganizationAccessToken]]:
        return self.get_base_statement().where(
            OrganizationAccessToken.organization_id.in_(org_ids)
        )

    async def has_by_organization_id(self, organization_id: UUID) -> bool:
        """Whether the organization has any active access token."""
        statement = (
            sql.select(OrganizationAccessToken.id)
            .where(
                OrganizationAccessToken.organization_id == organization_id,
                ~OrganizationAccessToken.is_deleted,
            )
            .limit(1)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none() is not None
