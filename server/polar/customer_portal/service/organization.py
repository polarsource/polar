from sqlalchemy import select
from sqlalchemy.orm import selectinload

from polar.kit.services import ResourceServiceReader
from polar.models import Organization, Product, ProductVisibility
from polar.postgres import AsyncSession


class CustomerOrganizationService(ResourceServiceReader[Organization]):
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
