from uuid import UUID

from sqlalchemy import Select, update

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.kit.utils import utc_now
from polar.models import OrganizationDomain


class OrganizationDomainRepository(
    RepositorySoftDeletionIDMixin[OrganizationDomain, UUID],
    RepositorySoftDeletionMixin[OrganizationDomain],
    RepositoryBase[OrganizationDomain],
):
    model = OrganizationDomain

    def get_statement_by_organization(
        self, organization_id: UUID
    ) -> Select[OrganizationDomain]:
        return self.get_base_statement().where(
            OrganizationDomain.organization_id == organization_id
        )

    def get_verified_statement_by_organization(
        self, organization_id: UUID
    ) -> Select[OrganizationDomain]:
        return self.get_statement_by_organization(organization_id).where(
            OrganizationDomain.verified_at.is_not(None)
        )

    async def get_by_organization_and_id(
        self, organization_id: UUID, id: UUID
    ) -> OrganizationDomain | None:
        statement = self.get_statement_by_organization(organization_id).where(
            OrganizationDomain.id == id
        )
        return await self.get_one_or_none(statement)

    async def get_verified_by_organization_and_domain(
        self, organization_id: UUID, domain: str
    ) -> OrganizationDomain | None:
        statement = self.get_verified_statement_by_organization(organization_id).where(
            OrganizationDomain.domain == domain
        )
        return await self.get_one_or_none(statement)

    async def soft_delete_by_organization(self, organization_id: UUID) -> None:
        await self.session.execute(
            update(OrganizationDomain)
            .where(
                OrganizationDomain.organization_id == organization_id,
                OrganizationDomain.deleted_at.is_(None),
            )
            .values(deleted_at=utc_now())
        )
