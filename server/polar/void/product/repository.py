from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.orm import selectinload, with_polymorphic

from polar.kit.repository import RepositoryBase
from polar.models import Meter as MeterModel
from polar.models import Product as ProductModel
from polar.models import ProductPrice

PRICES = with_polymorphic(ProductPrice, "*")


class ProductRepository(RepositoryBase[ProductModel]):
    model = ProductModel

    def get_base_statement(self) -> Select[tuple[ProductModel]]:
        return select(ProductModel).options(
            selectinload(ProductModel.prices.of_type(PRICES))
            .selectinload(PRICES.ProductPriceMeteredUnit.meter)
            .selectinload(MeterModel.deployment),
        )

    def scoped_statement(self, organization_id: UUID) -> Select[tuple[ProductModel]]:
        return self.get_base_statement().where(
            ProductModel.organization_id == organization_id,
            ProductModel.deleted_at.is_(None),
            ProductModel.version_id.is_not(None),
        )

    async def list(self, organization_id: UUID) -> Sequence[ProductModel]:
        return await self.get_all(
            self.scoped_statement(organization_id).order_by(
                ProductModel.created_at, ProductModel.id
            )
        )

    async def get(self, organization_id: UUID, id: UUID) -> ProductModel | None:
        return await self.get_one_or_none(
            self.scoped_statement(organization_id).where(ProductModel.id == id)
        )
