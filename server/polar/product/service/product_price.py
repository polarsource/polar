import uuid

from sqlalchemy import select
from sqlalchemy.orm import contains_eager, joinedload

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.exceptions import PolarError
from polar.kit.db.postgres import AsyncSession
from polar.kit.services import ResourceServiceReader
from polar.models import Organization, Product, ProductPrice, User, UserOrganization


class ProductPriceError(PolarError): ...


class ProductPriceService(ResourceServiceReader[ProductPrice]):
    async def get_by_id(
        self, session: AsyncSession, id: uuid.UUID
    ) -> ProductPrice | None:
        statement = (
            select(ProductPrice)
            .where(ProductPrice.id == id)
            .options(joinedload(ProductPrice.product))
        )

        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def get_by_stripe_price_id(
        self, session: AsyncSession, stripe_price_id: str
    ) -> ProductPrice | None:
        statement = (
            select(ProductPrice)
            .where(ProductPrice.stripe_price_id == stripe_price_id)
            .options(joinedload(ProductPrice.product))
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def get_writable_by_id(
        self,
        session: AsyncSession,
        id: uuid.UUID,
        auth_subject: AuthSubject[User | Organization],
    ) -> ProductPrice | None:
        statement = (
            select(ProductPrice)
            .where(ProductPrice.id == id, ProductPrice.deleted_at.is_(None))
            .join(ProductPrice.product)
            .join(Organization, Organization.id == Product.organization_id)
            .options(
                contains_eager(ProductPrice.product).contains_eager(
                    Product.organization
                )
            )
        )
        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                Product.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Product.organization_id == auth_subject.subject.id,
            )

        result = await session.execute(statement)
        return result.scalar_one_or_none()


product_price = ProductPriceService(ProductPrice)
