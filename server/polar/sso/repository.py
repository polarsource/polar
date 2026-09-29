from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import OrganizationDomain, OrganizationSSOConnection


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

    async def get_enabled_by_organization(
        self, organization_id: UUID
    ) -> Sequence[OrganizationSSOConnection]:
        statement = self.get_statement_by_organization(organization_id).where(
            OrganizationSSOConnection.enabled
        )
        return await self.get_all(statement)

    async def get_enabled_by_organization_and_id(
        self, organization_id: UUID, id: UUID
    ) -> OrganizationSSOConnection | None:
        statement = self.get_statement_by_organization(organization_id).where(
            OrganizationSSOConnection.id == id,
            OrganizationSSOConnection.enabled,
        )
        return await self.get_one_or_none(statement)


class OrganizationDomainRepository(
    RepositorySoftDeletionIDMixin[OrganizationDomain, UUID],
    RepositorySoftDeletionMixin[OrganizationDomain],
    RepositoryBase[OrganizationDomain],
):
    model = OrganizationDomain

    def get_verified_statement_by_organization(
        self, organization_id: UUID
    ) -> Select[tuple[OrganizationDomain]]:
        return self.get_base_statement().where(
            OrganizationDomain.organization_id == organization_id,
            OrganizationDomain.verified_at.is_not(None),
        )
