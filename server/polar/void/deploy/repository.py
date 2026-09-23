import builtins
from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, select

from polar.kit.repository import RepositoryBase
from polar.models import Benefit, VoidDeployment, VoidReducer
from polar.models.void_deployment import VoidDeploymentStatus


class DeployRepository(RepositoryBase[VoidDeployment]):
    model = VoidDeployment

    def scoped_statement(self, organization_id: UUID) -> Select[tuple[VoidDeployment]]:
        return select(VoidDeployment).where(
            VoidDeployment.organization_id == organization_id,
            VoidDeployment.deleted_at.is_(None),
        )

    async def list(self, organization_id: UUID) -> Sequence[VoidDeployment]:
        return await self.get_all(
            self.scoped_statement(organization_id).order_by(
                VoidDeployment.created_at.desc(), VoidDeployment.id.desc()
            )
        )

    async def get(self, organization_id: UUID, id: UUID) -> VoidDeployment | None:
        return await self.get_one_or_none(
            self.scoped_statement(organization_id).where(VoidDeployment.id == id)
        )

    async def by_version(
        self, organization_id: UUID, version_id: str
    ) -> VoidDeployment | None:
        return await self.get_one_or_none(
            self.scoped_statement(organization_id).where(
                VoidDeployment.version_id == version_id
            )
        )

    async def active(self, organization_id: UUID) -> VoidDeployment | None:
        return await self.get_one_or_none(
            self.scoped_statement(organization_id).where(
                VoidDeployment.status == VoidDeploymentStatus.active
            )
        )

    async def reserved_slugs(
        self,
        organization_id: UUID,
        reducer_slugs: set[str],
        entitlement_slugs: set[str],
    ) -> builtins.list[tuple[str, str]]:
        reducers = await self.session.scalars(
            select(VoidReducer.slug).where(
                VoidReducer.organization_id == organization_id,
                VoidReducer.slug.in_(reducer_slugs),
                VoidReducer.deleted_at.is_not(None),
            )
        )
        entitlements = await self.session.scalars(
            select(Benefit.slug).where(
                Benefit.organization_id == organization_id,
                Benefit.slug.in_(entitlement_slugs),
                Benefit.deleted_at.is_not(None),
            )
        )
        return [("reducer", slug) for slug in reducers] + [
            ("entitlement", slug) for slug in entitlements
        ]
