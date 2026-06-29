from collections.abc import Sequence
from uuid import UUID

from sqlalchemy.orm import joinedload, selectinload

from polar.kit.repository import RepositoryBase
from polar.models import PricingCompany, PricingProduct, PricingSnapshot


class PricingCompanyRepository(RepositoryBase[PricingCompany]):
    model = PricingCompany

    async def get_by_id(self, id: UUID) -> PricingCompany | None:
        statement = self.get_base_statement().where(PricingCompany.id == id)
        return await self.get_one_or_none(statement)

    async def get_by_slug(self, slug: str) -> PricingCompany | None:
        statement = (
            self.get_base_statement()
            .where(PricingCompany.slug == slug)
            .options(selectinload(PricingCompany.products))
        )
        return await self.get_one_or_none(statement)

    async def get_detail(self, slug: str) -> PricingCompany | None:
        statement = (
            self.get_base_statement()
            .where(PricingCompany.slug == slug)
            .options(
                selectinload(PricingCompany.products).selectinload(
                    PricingProduct.snapshots
                )
            )
        )
        return await self.get_one_or_none(statement)

    async def list_all(self) -> Sequence[PricingCompany]:
        return await self.get_all(self.get_base_statement())

    async def list_with_products(self) -> Sequence[PricingCompany]:
        statement = (
            self.get_base_statement()
            .options(selectinload(PricingCompany.products))
            .order_by(PricingCompany.name)
        )
        return await self.get_all(statement)


class PricingProductRepository(RepositoryBase[PricingProduct]):
    model = PricingProduct

    async def get_by_company_and_name(
        self, company_id: UUID, name: str
    ) -> PricingProduct | None:
        statement = self.get_base_statement().where(
            PricingProduct.company_id == company_id,
            PricingProduct.name == name,
        )
        return await self.get_one_or_none(statement)

    async def list_for_company(
        self, company_id: UUID
    ) -> Sequence[PricingProduct]:
        statement = self.get_base_statement().where(
            PricingProduct.company_id == company_id
        )
        return await self.get_all(statement)


class PricingSnapshotRepository(RepositoryBase[PricingSnapshot]):
    model = PricingSnapshot

    async def list_for_product(
        self, product_id: UUID
    ) -> Sequence[PricingSnapshot]:
        statement = (
            self.get_base_statement()
            .where(PricingSnapshot.product_id == product_id)
            .order_by(PricingSnapshot.captured_at.desc())
        )
        return await self.get_all(statement)

    async def list_recent(self, limit: int) -> Sequence[PricingSnapshot]:
        statement = (
            self.get_base_statement()
            .options(
                joinedload(PricingSnapshot.product).joinedload(
                    PricingProduct.company
                )
            )
            .order_by(PricingSnapshot.captured_at.desc())
            .limit(limit)
        )
        return await self.get_all(statement)
