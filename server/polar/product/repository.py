from collections.abc import Sequence
from uuid import UUID

from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.sql.base import ExecutableOption

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import CheckoutProduct, Product


class ProductRepository(
    RepositorySoftDeletionIDMixin[Product, UUID],
    RepositorySoftDeletionMixin[Product],
    RepositoryBase[Product],
):
    model = Product

    async def get_by_id_and_organization(
        self,
        id: UUID,
        organization_id: UUID,
        *,
        options: Sequence[ExecutableOption] = (),
    ) -> Product | None:
        statement = (
            self.get_base_statement()
            .where(Product.id == id, Product.organization_id == organization_id)
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_by_id_and_checkout(
        self,
        id: UUID,
        checkout_id: UUID,
        *,
        options: Sequence[ExecutableOption] = (),
    ) -> Product | None:
        statement = (
            self.get_base_statement()
            .join(CheckoutProduct, onclause=Product.id == CheckoutProduct.product_id)
            .where(
                Product.id == id,
                CheckoutProduct.checkout_id == checkout_id,
            )
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    def get_eager_options(self) -> Sequence[ExecutableOption]:
        return (
            joinedload(Product.organization),
            selectinload(Product.product_medias),
            selectinload(Product.attached_custom_fields),
        )
