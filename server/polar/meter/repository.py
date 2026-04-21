from uuid import UUID

from sqlalchemy import Select

from polar.auth.models import AuthSubject
from polar.authz.service import get_accessible_org_ids
from polar.kit.repository import RepositoryBase, RepositoryIDMixin
from polar.models import Meter, Organization, User


class MeterRepository(RepositoryBase[Meter], RepositoryIDMixin[Meter, UUID]):
    model = Meter

    def get_by_org_ids_statement(
        self, org_ids: set[UUID]
    ) -> Select[tuple[Meter]]:
        return self.get_base_statement().where(
            Meter.organization_id.in_(org_ids)
        )

    async def get_readable_by_id(
        self,
        id: UUID,
        auth_subject: AuthSubject[User | Organization],
    ) -> Meter | None:
        org_ids = await get_accessible_org_ids(self.session, auth_subject)
        statement = self.get_by_org_ids_statement(org_ids).where(Meter.id == id)
        return await self.get_one_or_none(statement)
