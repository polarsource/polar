from uuid import UUID

from sqlalchemy import Select

from polar.authz.types import AccessibleOrganizationID
from polar.kit.repository import RepositoryBase, RepositoryIDMixin
from polar.models import Meter


class MeterRepository(RepositoryBase[Meter], RepositoryIDMixin[Meter, UUID]):
    model = Meter

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[Meter]]:
        return self.get_base_statement().where(Meter.organization_id.in_(org_ids))

    async def get_readable_by_id(
        self,
        id: UUID,
        org_ids: set[AccessibleOrganizationID],
    ) -> Meter | None:
        statement = self.get_statement_by_org_ids(org_ids).where(Meter.id == id)
        return await self.get_one_or_none(statement)
