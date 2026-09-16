from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.orm import joinedload

from polar.kit.repository import RepositoryBase
from polar.models import VoidBranch, VoidDeployment


class BranchRepository(RepositoryBase[VoidBranch]):
    model = VoidBranch

    def scoped_statement(self, organization_id: UUID) -> Select[tuple[VoidBranch]]:
        return (
            select(VoidBranch)
            .where(
                VoidBranch.organization_id == organization_id,
                VoidBranch.deleted_at.is_(None),
            )
            .options(joinedload(VoidBranch.base_deployment))
        )

    async def list(self, organization_id: UUID) -> Sequence[VoidBranch]:
        return await self.get_all(
            self.scoped_statement(organization_id).order_by(
                VoidBranch.created_at.desc(), VoidBranch.id.desc()
            )
        )

    async def get(self, organization_id: UUID, id: UUID) -> VoidBranch | None:
        return await self.get_one_or_none(
            self.scoped_statement(organization_id).where(VoidBranch.id == id)
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
