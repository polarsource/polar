from uuid import UUID

from sqlalchemy import Select

from polar.kit.repository import RepositoryBase, RepositoryIDMixin
from polar.models import MetricDashboard


class MetricDashboardRepository(
    RepositoryBase[MetricDashboard], RepositoryIDMixin[MetricDashboard, UUID]
):
    model = MetricDashboard

    def get_by_org_ids_statement(
        self, org_ids: set[UUID]
    ) -> Select[tuple[MetricDashboard]]:
        statement = self.get_base_statement()
        statement = statement.where(MetricDashboard.organization_id.in_(org_ids))
        return statement
