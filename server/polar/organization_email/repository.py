from collections.abc import Sequence
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

    def get_history_statement(self, organization_id: UUID) -> Select[OrganizationEmail]:
        return self.get_statement_by_organization(organization_id).order_by(
            OrganizationEmail.created_at.desc()
        )

    async def get_latest_by_organization(
        self, organization_id: UUID
    ) -> OrganizationEmail | None:
        return await self.get_one_or_none(
            self.get_history_statement(organization_id).limit(1)
        )

    async def get_history_by_organization(
        self, organization_id: UUID
    ) -> Sequence[OrganizationEmail]:
        return await self.get_all(self.get_history_statement(organization_id))
