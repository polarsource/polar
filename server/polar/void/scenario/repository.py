from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.orm import joinedload

from polar.kit.repository import RepositoryBase
from polar.models import VoidDeployment, VoidScenario


class ScenarioRepository(RepositoryBase[VoidScenario]):
    model = VoidScenario

    def scoped_statement(self, organization_id: UUID) -> Select[tuple[VoidScenario]]:
        return (
            select(VoidScenario)
            .where(
                VoidScenario.organization_id == organization_id,
                VoidScenario.deleted_at.is_(None),
            )
            .options(joinedload(VoidScenario.base_deployment))
        )

    async def list(self, organization_id: UUID) -> Sequence[VoidScenario]:
        return await self.get_all(
            self.scoped_statement(organization_id).order_by(
                VoidScenario.created_at.desc(), VoidScenario.id.desc()
            )
        )

    async def get(self, organization_id: UUID, id: UUID) -> VoidScenario | None:
        return await self.get_one_or_none(
            self.scoped_statement(organization_id).where(VoidScenario.id == id)
        )

    async def deployments_by_version(
        self, organization_id: UUID, version_ids: set[str]
    ) -> dict[str, UUID]:
        if not version_ids:
            return {}
        rows = await self.session.execute(
            select(VoidDeployment.version_id, VoidDeployment.id).where(
                VoidDeployment.organization_id == organization_id,
                VoidDeployment.deleted_at.is_(None),
                VoidDeployment.version_id.in_(version_ids),
            )
        )
        return {version_id: id for version_id, id in rows}
