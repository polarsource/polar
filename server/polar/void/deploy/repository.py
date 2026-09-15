from uuid import UUID

from sqlalchemy import select

from polar.kit.repository import RepositoryBase
from polar.models import VoidDeployment, VoidEntitlement, VoidReducer


class DeployRepository(RepositoryBase[VoidDeployment]):
    model = VoidDeployment

    async def latest(
        self, organization_id: UUID, variant_id: str | None
    ) -> VoidDeployment | None:
        return await self.get_one_or_none(
            select(VoidDeployment)
            .where(
                VoidDeployment.organization_id == organization_id,
                VoidDeployment.variant_id.is_not_distinct_from(variant_id),
                VoidDeployment.deleted_at.is_(None),
            )
            .order_by(VoidDeployment.created_at.desc(), VoidDeployment.id.desc())
            .limit(1)
        )

    async def reserved_slugs(
        self,
        organization_id: UUID,
        reducer_slugs: set[str],
        entitlement_slugs: set[str],
    ) -> list[tuple[str, str]]:
        reducers = await self.session.scalars(
            select(VoidReducer.slug).where(
                VoidReducer.organization_id == organization_id,
                VoidReducer.slug.in_(reducer_slugs),
                VoidReducer.deleted_at.is_not(None),
            )
        )
        entitlements = await self.session.scalars(
            select(VoidEntitlement.slug).where(
                VoidEntitlement.organization_id == organization_id,
                VoidEntitlement.slug.in_(entitlement_slugs),
                VoidEntitlement.deleted_at.is_not(None),
            )
        )
        return [("reducer", slug) for slug in reducers] + [
            ("entitlement", slug) for slug in entitlements
        ]
