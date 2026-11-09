from uuid import UUID

from sqlalchemy import Select

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import OrganizationEmail


class OrganizationEmailRepository(
    RepositorySoftDeletionIDMixin[OrganizationEmail, UUID],
    RepositorySoftDeletionMixin[OrganizationEmail],
    RepositoryBase[OrganizationEmail],
):
    model = OrganizationEmail

    def get_statement_by_organization(
        self, organization_id: UUID
    ) -> Select[OrganizationEmail]:
        return self.get_base_statement().where(
            OrganizationEmail.organization_id == organization_id
        )

    async def get_latest_by_organization(
        self, organization_id: UUID
    ) -> OrganizationEmail | None:
        statement = (
            self.get_statement_by_organization(organization_id)
            .order_by(OrganizationEmail.created_at.desc())
            .limit(1)
        )
        return await self.get_one_or_none(statement)
