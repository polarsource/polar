from collections.abc import Sequence
from typing import Unpack
from uuid import UUID

from sqlalchemy import select

from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.models import (
    Benefit,
    BenefitGrant,
    Customer,
    Member,
    Product,
    ProductBenefit,
)
from polar.models.benefit import BenefitType
from polar.models.benefit_grant import BenefitGrantScope

from .sorting import BenefitGrantSortProperty


class BenefitGrantRepository(
    RepositorySortingMixin[BenefitGrant, BenefitGrantSortProperty],
    RepositorySoftDeletionIDMixin[BenefitGrant, UUID],
    RepositorySoftDeletionMixin[BenefitGrant],
    RepositoryBase[BenefitGrant],
):
    model = BenefitGrant

    async def get_by_benefit_and_scope(
        self,
        customer: Customer,
        benefit: Benefit,
        member: Member | None = None,
        **scope: Unpack[BenefitGrantScope],
    ) -> BenefitGrant | None:
        statement = self.get_base_statement().where(
            BenefitGrant.customer_id == customer.id,
            BenefitGrant.benefit_id == benefit.id,
            BenefitGrant.member_id == (member.id if member else None),
            BenefitGrant.deleted_at.is_(None),
            BenefitGrant.scope == scope,
        )
        return await self.get_one_or_none(statement)

    async def list_granted_by_scope(
        self, **scope: Unpack[BenefitGrantScope]
    ) -> Sequence[BenefitGrant]:
        statement = self.get_base_statement().where(
            BenefitGrant.scope == scope,
            BenefitGrant.is_granted.is_(True),
            BenefitGrant.deleted_at.is_(None),
        )
        return await self.get_all(statement)

    async def list_granted_by_benefit(
        self,
        benefit: Benefit,
        *,
        options: Options = (),
    ) -> Sequence[BenefitGrant]:
        statement = (
            self.get_base_statement()
            .where(
                BenefitGrant.benefit_id == benefit.id,
                BenefitGrant.is_granted.is_(True),
                BenefitGrant.deleted_at.is_(None),
            )
            .options(*options)
        )
        return await self.get_all(statement)

    async def list_granted_by_customer(
        self,
        customer_id: UUID,
        *,
        options: Options = (),
    ) -> Sequence[BenefitGrant]:
        statement = (
            self.get_base_statement()
            .where(
                BenefitGrant.customer_id == customer_id,
                BenefitGrant.is_granted.is_(True),
                BenefitGrant.deleted_at.is_(None),
            )
            .options(*options)
        )
        return await self.get_all(statement)

    async def list_granted_by_benefit_and_customer(
        self,
        benefit: Benefit,
        customer: Customer,
        *,
        options: Options = (),
    ) -> Sequence[BenefitGrant]:
        statement = (
            self.get_base_statement()
            .where(
                BenefitGrant.benefit_id == benefit.id,
                BenefitGrant.customer_id == customer.id,
                BenefitGrant.is_granted.is_(True),
                BenefitGrant.deleted_at.is_(None),
            )
            .options(*options)
        )
        return await self.get_all(statement)

    async def list_by_customer_and_benefit_type(
        self,
        customer: Customer,
        benefit_type: BenefitType,
        *,
        options: Options = (),
    ) -> Sequence[BenefitGrant]:
        statement = (
            self.get_base_statement()
            .join(Benefit)
            .where(
                BenefitGrant.customer_id == customer.id,
                Benefit.type == benefit_type,
            )
        ).options(*options)
        return await self.get_all(statement)

    async def list_by_customer_and_scope(
        self,
        customer: Customer,
        **scope: Unpack[BenefitGrantScope],
    ) -> Sequence[BenefitGrant]:
        statement = self.get_base_statement().where(
            BenefitGrant.customer_id == customer.id,
            BenefitGrant.scope == scope,
            BenefitGrant.deleted_at.is_(None),
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

    def get_sorting_clause(self, property: BenefitGrantSortProperty) -> SortingClause:
        match property:
            case BenefitGrantSortProperty.created_at:
                return BenefitGrant.created_at
            case BenefitGrantSortProperty.granted_at:
                return BenefitGrant.granted_at
            case BenefitGrantSortProperty.revoked_at:
                return BenefitGrant.revoked_at
