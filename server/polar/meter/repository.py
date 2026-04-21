from uuid import UUID

from sqlalchemy import Select

from polar.kit.repository import RepositoryBase, RepositoryIDMixin
from polar.models import Meter


class MeterRepository(RepositoryBase[Meter], RepositoryIDMixin[Meter, UUID]):
    model = Meter

    def get_by_org_ids_statement(
        self, org_ids: set[UUID]
    ) -> Select[tuple[Meter]]:
        return self.get_base_statement().where(
            Meter.organization_id.in_(org_ids)
        )
