from uuid import UUID

from sqlalchemy import exists, select

from polar.kit.repository import RepositoryBase
from polar.models import Organization, VoidDeployment
from polar.models.void_deployment import VoidDeploymentStatus


class OrganizationRepository(RepositoryBase[Organization]):
    model = Organization

    async def enabled_ids(self) -> set[UUID]:
        return set(
            await self.session.scalars(
                select(Organization.id).where(
                    Organization.deleted_at.is_(None),
                    Organization.can_authenticate,
                    Organization.feature_settings.contains({"void_enabled": True}),
                )
            )
        )

    async def is_enabled(self, organization_id: UUID) -> bool:
        return bool(
            await self.session.scalar(
                select(
                    exists().where(
                        Organization.id == organization_id,
                        Organization.deleted_at.is_(None),
                        Organization.can_authenticate,
                        Organization.feature_settings.contains({"void_enabled": True}),
                    )
                )
            )
        )

    async def lock(self, organization_id: UUID) -> Organization | None:
        return await self.session.scalar(
            select(Organization)
            .where(
                Organization.id == organization_id, Organization.deleted_at.is_(None)
            )
            # FOR NO KEY UPDATE keeps worker foreign-key checks unblocked.
            .with_for_update(key_share=True)
        )

    async def active_deployment(self, organization_id: UUID) -> VoidDeployment | None:
        return await self.session.scalar(
            select(VoidDeployment).where(
                VoidDeployment.organization_id == organization_id,
                VoidDeployment.status == VoidDeploymentStatus.active,
                VoidDeployment.deleted_at.is_(None),
            )
        )
