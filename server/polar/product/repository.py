from collections.abc import Sequence
from uuid import UUID

from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.sql.base import ExecutableOption

from polar.kit.repository import (
    RepositoryBase,
    RepositoryIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models.product import Product


class ProductRepository(
    RepositoryIDMixin[Product, UUID],
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
        statement = self.get_base_statement()
        statement = statement.where(
            Product.id == id, Product.organization_id == organization_id
        ).options(*options)
        return await self.get_one_or_none(statement)

    def get_eager_options(self) -> Sequence[ExecutableOption]:
        return (
            joinedload(Product.organization),
            selectinload(Product.product_medias),
            selectinload(Product.attached_custom_fields),
        )
