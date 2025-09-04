from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, or_, select, update
from sqlalchemy.orm import contains_eager

from polar.auth.models import AuthSubject, User
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.kit.utils import utc_now
from polar.models import Organization, OrganizationAccessToken, UserOrganization
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

    def get_readable_statement(
        self, auth_subject: AuthSubject[User]
    ) -> Select[tuple[OrganizationAccessToken]]:
        statement = self.get_base_statement()
        user = auth_subject.subject
        statement = statement.where(
            OrganizationAccessToken.organization_id.in_(
                select(UserOrganization.organization_id).where(
                    UserOrganization.user_id == user.id,
                    UserOrganization.deleted_at.is_(None),
                )
            )
        )
        return statement

    async def count_by_organization_id(
        self,
        organization_id: UUID,
    ) -> int:
        """Count active organization access tokens for an organization."""
        count = await self.session.scalar(
            sql.select(sql.func.count(OrganizationAccessToken.id)).where(
                OrganizationAccessToken.organization_id == organization_id,
                OrganizationAccessToken.deleted_at.is_(None),
            )
        )
        return count or 0
