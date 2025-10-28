from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from polar.kit.pagination import PaginationParams, paginate
from polar.models import Customer, Order, Organization, Product, Subscription
from polar.postgres import AsyncSession


class StorefrontService:
    async def get(self, session: AsyncSession, slug: str) -> Organization | None:
        statement = (
            select(Organization)
            .where(
                Organization.deleted_at.is_(None),
                Organization.blocked_at.is_(None),
                Organization.slug == slug,
                Organization.storefront_enabled.is_(True),
            )
            .options(
                selectinload(Organization.products).options(
                    selectinload(Product.product_medias)
                )
            )
        )
        result = await session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def get_organization_slug_by_product_id(
        self, session: AsyncSession, product_id: str
    ) -> str | None:
        """Get organization slug by product ID for legacy redirect purposes."""
        statement = (
            select(Organization.slug)
            .join(Product, Product.organization_id == Organization.id)
            .where(
                Product.id == product_id,
                Product.deleted_at.is_(None),
                Organization.deleted_at.is_(None),
                Organization.blocked_at.is_(None),
            )
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def get_organization_slug_by_subscription_id(
        self, session: AsyncSession, subscription_id: str
    ) -> str | None:
        """Get organization slug by subscription ID for legacy redirect purposes."""
        statement = (
            select(Organization.slug)
            .join(Product, Product.organization_id == Organization.id)
            .join(Subscription, Subscription.product_id == Product.id)
            .where(
                Subscription.id == subscription_id,
                Subscription.deleted_at.is_(None),
                Product.deleted_at.is_(None),
                Organization.deleted_at.is_(None),
                Organization.blocked_at.is_(None),
            )
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def list_customers(
        self,
        session: AsyncSession,
        organization: Organization,
        *,
        pagination: PaginationParams,
    ) -> tuple[Sequence[Customer], int]:
        statement = select(Customer).where(
            Customer.id.in_(
                select(Order.customer_id)
                .join(Product, Product.id == Order.product_id, isouter=True)
                .where(
                    Order.deleted_at.is_(None),
                    Product.organization_id == organization.id,
                )
            )
        )
        results, count = await paginate(session, statement, pagination=pagination)
        return results, count


storefront = StorefrontService()
