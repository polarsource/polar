from collections.abc import Sequence
from typing import Unpack
from uuid import UUID

from sqlalchemy import select

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Benefit, BenefitGrant, Customer, Product, ProductBenefit
from polar.models.benefit import BenefitType
from polar.models.benefit_grant import BenefitGrantScope


class BenefitGrantRepository(
    RepositorySoftDeletionIDMixin[BenefitGrant, UUID],
    RepositorySoftDeletionMixin[BenefitGrant],
    RepositoryBase[BenefitGrant],
):
    model = BenefitGrant

    async def get_by_benefit_and_scope(
        self, customer: Customer, benefit: Benefit, **scope: Unpack[BenefitGrantScope]
    ) -> BenefitGrant | None:
        statement = self.get_base_statement().where(
            BenefitGrant.customer_id == customer.id,
            BenefitGrant.benefit_id == benefit.id,
            BenefitGrant.deleted_at.is_(None),
            BenefitGrant.scope == scope,
        )
        return await self.get_one_or_none(statement)

    async def list_granted_by_benefit(self, benefit: Benefit) -> Sequence[BenefitGrant]:
        statement = self.get_base_statement().where(
            BenefitGrant.benefit_id == benefit.id,
            BenefitGrant.is_granted.is_(True),
            BenefitGrant.deleted_at.is_(None),
        )
        return await self.get_all(statement)

    async def list_granted_by_customer(
        self, customer: Customer
    ) -> Sequence[BenefitGrant]:
        statement = self.get_base_statement().where(
            BenefitGrant.customer_id == customer.id,
            BenefitGrant.is_granted.is_(True),
            BenefitGrant.deleted_at.is_(None),
        )
        return await self.get_all(statement)

    async def list_granted_by_benefit_and_customer(
        self, benefit: Benefit, customer: Customer
    ) -> Sequence[BenefitGrant]:
        statement = self.get_base_statement().where(
            BenefitGrant.benefit_id == benefit.id,
            BenefitGrant.customer_id == customer.id,
            BenefitGrant.is_granted.is_(True),
            BenefitGrant.deleted_at.is_(None),
        )
        return await self.get_all(statement)

    async def list_by_customer_and_benefit_type(
        self, customer: Customer, benefit_type: BenefitType
    ) -> Sequence[BenefitGrant]:
        statement = (
            self.get_base_statement()
            .join(Benefit)
            .where(
                BenefitGrant.customer_id == customer.id,
                Benefit.type == benefit_type,
            )
        )
        return await self.get_all(statement)

    async def list_outdated_grants(
        self, product: Product, **scope: Unpack[BenefitGrantScope]
    ) -> Sequence[BenefitGrant]:
        product_benefits_statement = (
            select(Benefit.id)
            .join(ProductBenefit)
            .where(ProductBenefit.product_id == product.id)
        )
        statement = self.get_base_statement().where(
            BenefitGrant.scope == scope,
            BenefitGrant.benefit_id.not_in(product_benefits_statement),
            BenefitGrant.is_granted.is_(True),
            BenefitGrant.deleted_at.is_(None),
        )
        return await self.get_all(statement)
