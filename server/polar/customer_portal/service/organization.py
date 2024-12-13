from sqlalchemy import select

from polar.kit.services import ResourceServiceReader
from polar.models import Organization
from polar.postgres import AsyncSession


class CustomerOrganizationService(ResourceServiceReader[Organization]):
    async def get_by_slug(
        self, session: AsyncSession, slug: str
    ) -> Organization | None:
        statement = select(Organization).where(
            Organization.deleted_at.is_(None),
            Organization.blocked_at.is_(None),
            Organization.slug == slug,
        )
        result = await session.execute(statement)
        return result.unique().scalar_one_or_none()


customer_organization = CustomerOrganizationService(Organization)
