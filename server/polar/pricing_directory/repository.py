from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import delete, or_, update
from sqlalchemy.orm import joinedload, selectinload

from polar.kit.repository import RepositoryBase
from polar.models import (
    PricingCompany,
    PricingFeature,
    PricingMetric,
    PricingProduct,
    PricingSnapshot,
)


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
                ),
                selectinload(PricingCompany.products).selectinload(
                    PricingProduct.metrics
                ),
                selectinload(PricingCompany.products).selectinload(
                    PricingProduct.features
                ),
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

    async def reconcile_status(
        self, company_id: UUID, seen_names: list[str]
    ) -> None:
        """Mark a company's unseen products `legacy`, and (re)activate seen ones.

        We never delete — the price history of a discontinued plan is kept.
        """
        await self.session.execute(
            update(PricingProduct)
            .where(
                PricingProduct.company_id == company_id,
                PricingProduct.name.not_in(seen_names),
            )
            .values(status="legacy")
        )
        await self.session.execute(
            update(PricingProduct)
            .where(
                PricingProduct.company_id == company_id,
                PricingProduct.name.in_(seen_names),
            )
            .values(status="active")
        )


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


class PricingMetricRepository(RepositoryBase[PricingMetric]):
    model = PricingMetric

    async def delete_for_product(self, product_id: UUID) -> None:
        await self.session.execute(
            delete(PricingMetric).where(PricingMetric.product_id == product_id)
        )

    async def search(
        self, *, unit: str | None = None, query: str | None = None
    ) -> Sequence[PricingMetric]:
        unit_price = PricingMetric.amount / PricingMetric.per_quantity
        statement = (
            self.get_base_statement()
            .where(PricingMetric.amount > 0)
            .options(
                joinedload(PricingMetric.product).joinedload(
                    PricingProduct.company
                )
            )
            .order_by(unit_price.asc())
        )
        if unit is not None:
            statement = statement.where(PricingMetric.unit == unit)
        if query:
            term = f"%{query}%"
            statement = statement.where(
                or_(
                    PricingMetric.unit.ilike(term),
                    PricingMetric.label.ilike(term),
                    PricingMetric.raw.ilike(term),
                )
            )
        return await self.get_all(statement)


class PricingFeatureRepository(RepositoryBase[PricingFeature]):
    model = PricingFeature

    async def delete_for_product(self, product_id: UUID) -> None:
        await self.session.execute(
            delete(PricingFeature).where(
                PricingFeature.product_id == product_id
            )
        )

    async def search(
        self,
        *,
        category: str | None = None,
        key: str | None = None,
        query: str | None = None,
    ) -> Sequence[PricingFeature]:
        statement = (
            self.get_base_statement()
            .options(
                joinedload(PricingFeature.product).joinedload(
                    PricingProduct.company
                )
            )
            .order_by(PricingFeature.category, PricingFeature.key)
        )
        if category is not None:
            statement = statement.where(PricingFeature.category == category)
        if key is not None:
            statement = statement.where(PricingFeature.key == key)
        if query:
            term = f"%{query}%"
            statement = statement.where(
                or_(
                    PricingFeature.name.ilike(term),
                    PricingFeature.key.ilike(term),
                )
            )
        return await self.get_all(statement)
