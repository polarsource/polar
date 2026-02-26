from uuid import UUID

from sqlalchemy import exists, select
from sqlalchemy.orm import selectinload

from polar.kit.services import ResourceServiceReader
from polar.models import Organization, Product, ProductVisibility
from polar.models.meter import Meter
from polar.postgres import AsyncSession


class CustomerOrganizationService(ResourceServiceReader[Organization]):
    async def has_active_meters(
        self, session: AsyncSession, organization_id: UUID
    ) -> bool:
        statement = select(
            exists().where(
                Meter.organization_id == organization_id,
                Meter.archived_at.is_(None),
            )
        )
        result = await session.execute(statement)
        return result.scalar_one()

    async def get_by_slug(
        self, session: AsyncSession, slug: str
    ) -> Organization | None:
        statement = (
            select(Organization)
            .where(
                Organization.is_deleted.is_(False),
                Organization.blocked_at.is_(None),
                Organization.slug == slug,
            )
            .options(
                selectinload(
                    Organization.products.and_(
                        Product.is_deleted.is_(False),
                        Product.is_archived.is_(False),
                        Product.visibility == ProductVisibility.public,
                    )
                ).options(
                    selectinload(Product.product_medias),
                )
            )
        )
        result = await session.execute(statement)
        return result.unique().scalar_one_or_none()


customer_organization = CustomerOrganizationService(Organization)
