from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, or_, update
from sqlalchemy.orm import contains_eager

from polar.authz.types import AccessibleOrganizationID
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.kit.utils import utc_now
from polar.models import Organization, OrganizationAccessToken
from polar.postgres import sql


class OrganizationAccessTokenRepository(
    RepositorySoftDeletionIDMixin[OrganizationAccessToken, UUID],
    RepositorySoftDeletionMixin[OrganizationAccessToken],
    RepositoryBase[OrganizationAccessToken],
):
    model = OrganizationAccessToken

    async def get_by_token_hash(
        self, token_hash: str, *, expired: bool = False
    ) -> OrganizationAccessToken | None:
        statement = (
            self.get_base_statement()
            .join(OrganizationAccessToken.organization)
            .where(
                OrganizationAccessToken.token == token_hash,
                Organization.can_authenticate.is_(True),
            )
            .options(contains_eager(OrganizationAccessToken.organization))
        )
        if not expired:
            statement = statement.where(
                or_(
                    OrganizationAccessToken.expires_at.is_(None),
                    OrganizationAccessToken.expires_at > utc_now(),
                )
            )
        return await self.get_one_or_none(statement)

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

    async def count_by_organization_id(
        self,
        organization_id: UUID,
    ) -> int:
        """Count active organization access tokens for an organization."""
        count = await self.session.scalar(
            sql.select(sql.func.count(OrganizationAccessToken.id)).where(
                OrganizationAccessToken.organization_id == organization_id,
                OrganizationAccessToken.is_deleted.is_(False),
            )
        )
        return count or 0

    async def has_by_organization_id(self, organization_id: UUID) -> bool:
        """Whether the organization has any active access token."""
        statement = (
            sql.select(OrganizationAccessToken.id)
            .where(
                OrganizationAccessToken.organization_id == organization_id,
                OrganizationAccessToken.is_deleted.is_(False),
            )
            .limit(1)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none() is not None
