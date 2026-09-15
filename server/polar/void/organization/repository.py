from uuid import UUID

from sqlalchemy import exists, or_, select

from polar.kit.repository import RepositoryBase
from polar.models import Organization, VoidMeter, VoidOrganizationSettings, VoidProduct


class OrganizationRepository(RepositoryBase[VoidOrganizationSettings]):
    model = VoidOrganizationSettings

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

    async def get_settings(
        self, organization_id: UUID
    ) -> VoidOrganizationSettings | None:
        return await self.get_one_or_none(
            select(VoidOrganizationSettings).where(
                VoidOrganizationSettings.organization_id == organization_id,
                VoidOrganizationSettings.deleted_at.is_(None),
            )
        )

    async def has_variant(self, organization_id: UUID, variant_id: str) -> bool:
        return bool(
            await self.session.scalar(
                select(
                    or_(
                        exists().where(
                            VoidProduct.organization_id == organization_id,
                            VoidProduct.variant_id == variant_id,
                            VoidProduct.deleted_at.is_(None),
                            VoidProduct.archived_at.is_(None),
                        ),
                        exists().where(
                            VoidMeter.organization_id == organization_id,
                            VoidMeter.variant_id == variant_id,
                            VoidMeter.deleted_at.is_(None),
                            VoidMeter.branch_id.is_(None),
                        ),
                    )
                )
            )
        )
