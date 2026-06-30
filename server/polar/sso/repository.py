from uuid import UUID

from sqlalchemy import Select

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import OrganizationSSOConnection


class OrganizationSSOConnectionRepository(
    RepositorySoftDeletionIDMixin[OrganizationSSOConnection, UUID],
    RepositorySoftDeletionMixin[OrganizationSSOConnection],
    RepositoryBase[OrganizationSSOConnection],
):
    model = OrganizationSSOConnection

    def get_statement_by_organization(
        self, organization_id: UUID
    ) -> Select[tuple[OrganizationSSOConnection]]:
        return self.get_base_statement().where(
            OrganizationSSOConnection.organization_id == organization_id
        )

    async def get_by_organization_and_id(
        self, organization_id: UUID, id: UUID
    ) -> OrganizationSSOConnection | None:
        statement = self.get_statement_by_organization(organization_id).where(
            OrganizationSSOConnection.id == id
        )
        return await self.get_one_or_none(statement)
