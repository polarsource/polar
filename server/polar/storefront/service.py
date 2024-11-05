from collections.abc import Sequence

from sqlalchemy import and_, select
from sqlalchemy.orm import selectinload

from polar.kit.pagination import PaginationParams, paginate
from polar.models import OAuthAccount, Order, Organization, Product, User
from polar.models.user import OAuthPlatform
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

    async def list_customers(
        self,
        session: AsyncSession,
        organization: Organization,
        *,
        pagination: PaginationParams,
    ) -> tuple[Sequence[User], int]:
        statement = (
            select(User)
            .join(
                OAuthAccount,
                onclause=and_(
                    User.id == OAuthAccount.user_id,
                    OAuthAccount.platform == OAuthPlatform.github,
                ),
                isouter=True,
            )
            .where(
                User.id.in_(
                    select(Order.user_id)
                    .join(Product, Product.id == Order.product_id)
                    .where(
                        Order.deleted_at.is_(None),
                        Product.organization_id == organization.id,
                    )
                )
            )
            .order_by(
                # Put users with a GitHub account first, so we can display their avatar
                OAuthAccount.created_at.desc().nulls_last()
            )
        )
        results, count = await paginate(session, statement, pagination=pagination)
        return results, count


storefront = StorefrontService()
