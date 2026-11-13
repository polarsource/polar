from collections.abc import Sequence
from typing import Unpack
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.orm import contains_eager, joinedload

from polar.authz.types import AccessibleOrganizationID
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
from polar.order.repository import order_benefits_revoked_clause

from .sorting import BenefitGrantSortProperty


class BenefitGrantRepository(
    RepositorySortingMixin[BenefitGrant, BenefitGrantSortProperty],
    RepositorySoftDeletionIDMixin[BenefitGrant, UUID],
    RepositorySoftDeletionMixin[BenefitGrant],
    RepositoryBase[BenefitGrant],
):
    model = BenefitGrant

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[BenefitGrant]:
        statement = self.get_base_statement().join(
            Benefit, BenefitGrant.benefit_id == Benefit.id
        )
        statement = statement.where(Benefit.organization_id.in_(org_ids))
        return statement

    async def get_by_benefit_and_scope(
        self,
        customer: Customer,
        benefit: Benefit,
        member: Member | None = None,
        *,
        for_update: bool = False,
        **scope: Unpack[BenefitGrantScope],
    ) -> BenefitGrant | None:
        statement = self.get_base_statement().where(
            BenefitGrant.customer_id == customer.id,
            BenefitGrant.benefit_id == benefit.id,
            BenefitGrant.member_id == (member.id if member else None),
            BenefitGrant.scope == scope,
        )
        if for_update:
            statement = statement.with_for_update(of=BenefitGrant).execution_options(
                populate_existing=True
            )
        return await self.get_one_or_none(statement)

    async def get_for_fulfillment(
        self, grant_id: UUID, *, customer_id: UUID, benefit_id: UUID
    ) -> BenefitGrant | None:
        statement = (
            self.get_base_statement()
            .where(
                BenefitGrant.id == grant_id,
                BenefitGrant.customer_id == customer_id,
                BenefitGrant.benefit_id == benefit_id,
            )
            .options(*self.get_eager_options())
            .with_for_update(of=BenefitGrant)
            .execution_options(populate_existing=True)
        )
        return await self.get_one_or_none(statement)

    async def list_granted_by_scope(
        self, **scope: Unpack[BenefitGrantScope]
    ) -> Sequence[BenefitGrant]:
        statement = self.get_base_statement().where(
            BenefitGrant.scope == scope,
            BenefitGrant.is_granted_and_unsuppressed,
            ~BenefitGrant.is_deleted,
        )
        return await self.get_all(statement)

    async def list_granted_meter_credits_by_subscription(
        self, subscription_id: UUID
    ) -> Sequence[BenefitGrant]:
        statement = (
            self.get_base_statement()
            .join(BenefitGrant.benefit)
            .where(
                BenefitGrant.subscription_id == subscription_id,
                BenefitGrant.is_granted,
                ~BenefitGrant.is_deleted,
                Benefit.type == BenefitType.meter_credit,
            )
            .options(
                contains_eager(BenefitGrant.benefit),
                joinedload(BenefitGrant.customer),
            )
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
                BenefitGrant.is_granted_and_unsuppressed,
                ~BenefitGrant.is_deleted,
            )
            .options(*options)
        )
        return await self.get_all(statement)

    async def count_granted_customers_by_benefit_external_ids(
        self, organization_id: UUID, external_ids: Sequence[str]
    ) -> dict[str, int]:
        """Count the customers granted each benefit, in any of its versions."""
        if not external_ids:
            return {}
        statement = (
            select(Benefit.external_id, func.count(BenefitGrant.customer_id.distinct()))
            .join(BenefitGrant, BenefitGrant.benefit_id == Benefit.id)
            .where(
                Benefit.organization_id == organization_id,
                Benefit.external_id.in_(external_ids),
                BenefitGrant.is_granted,
                ~BenefitGrant.is_deleted,
            )
            .group_by(Benefit.external_id)
        )
        result = await self.session.execute(statement)
        return {
            external_id: count
            for external_id, count in result.tuples()
            if external_id is not None
        }

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
                BenefitGrant.is_granted,
                ~BenefitGrant.is_deleted,
            )
            .options(*options)
        )
        return await self.get_all(statement)

    async def get_all_by_customer(
        self,
        customer_id: UUID,
        *,
        options: Options = (),
    ) -> Sequence[BenefitGrant]:
        statement = (
            self.get_base_statement(include_deleted=True)
            .where(BenefitGrant.customer_id == customer_id)
            .options(*options)
        )
        return await self.get_all(statement)

    async def list_unrevoked_by_member(
        self,
        member_id: UUID,
        *,
        options: Options = (),
    ) -> Sequence[BenefitGrant]:
        statement = (
            self.get_base_statement()
            .where(
                BenefitGrant.member_id == member_id,
                ~BenefitGrant.is_revoked,
                ~BenefitGrant.is_deleted,
            )
            .options(*options)
        )
        return await self.get_all(statement)

    async def list_granted_by_benefit_and_customer(
        self,
        benefit: Benefit,
        customer: Customer,
        *,
        member: Member | None = None,
        options: Options = (),
    ) -> Sequence[BenefitGrant]:
        statement = (
            self.get_base_statement()
            .where(
                BenefitGrant.benefit_id == benefit.id,
                BenefitGrant.customer_id == customer.id,
                BenefitGrant.is_granted_and_unsuppressed,
                ~BenefitGrant.is_deleted,
            )
            .options(*options)
        )
        if member is not None:
            statement = statement.where(BenefitGrant.member_id == member.id)
        return await self.get_all(statement)

    async def list_errored_by_customer_and_benefit_type(
        self,
        customer: Customer,
        benefit_type: BenefitType,
        error_type: str,
    ) -> Sequence[BenefitGrant]:
        statement = (
            self.get_base_statement()
            .join(Benefit)
            .where(
                BenefitGrant.customer_id == customer.id,
                Benefit.type == benefit_type,
                ~BenefitGrant.is_granted,
                ~BenefitGrant.is_revoked,
                ~BenefitGrant.is_deleted,
                BenefitGrant.error.is_not(None),
                BenefitGrant.manually_revoked_at.is_(None),
                BenefitGrant.error["type"].as_string() == error_type,
                ~order_benefits_revoked_clause(BenefitGrant.order_id),
            )
        )
        return await self.get_all(statement)

    async def list_errored_by_member_and_benefit_type(
        self,
        member: Member,
        benefit_type: BenefitType,
        error_type: str,
    ) -> Sequence[BenefitGrant]:
        statement = (
            self.get_base_statement()
            .join(Benefit)
            .where(
                BenefitGrant.member_id == member.id,
                Benefit.type == benefit_type,
                ~BenefitGrant.is_granted,
                ~BenefitGrant.is_revoked,
                ~BenefitGrant.is_deleted,
                BenefitGrant.error.is_not(None),
                BenefitGrant.manually_revoked_at.is_(None),
                BenefitGrant.error["type"].as_string() == error_type,
                ~order_benefits_revoked_clause(BenefitGrant.order_id),
            )
        )
        return await self.get_all(statement)

    async def list_by_customer_and_scope(
        self,
        customer: Customer,
        **scope: Unpack[BenefitGrantScope],
    ) -> Sequence[BenefitGrant]:
        statement = self.get_base_statement().where(
            BenefitGrant.customer_id == customer.id,
            BenefitGrant.scope == scope,
            ~BenefitGrant.is_deleted,
        )
        return await self.get_all(statement)

    async def list_by_member_and_scope(
        self,
        member: Member,
        **scope: Unpack[BenefitGrantScope],
    ) -> Sequence[BenefitGrant]:
        statement = self.get_base_statement().where(
            BenefitGrant.member_id == member.id,
            BenefitGrant.scope == scope,
            ~BenefitGrant.is_deleted,
        )
        return await self.get_all(statement)

    async def get_by_property_and_organization(
        self,
        organization_id: UUID,
        key: str,
        value: str,
        *,
        benefit_id: UUID | None = None,
        customer_id: UUID | None = None,
        for_update: bool = False,
        options: Options = (),
    ) -> BenefitGrant | None:
        filters = [
            BenefitGrant.properties[key].as_string() == value,
            Benefit.organization_id == organization_id,
        ]
        if benefit_id is not None:
            filters.append(BenefitGrant.benefit_id == benefit_id)
        if customer_id is not None:
            filters.append(BenefitGrant.customer_id == customer_id)

        statement = (
            self.get_base_statement()
            .join(Benefit, BenefitGrant.benefit_id == Benefit.id)
            .where(*filters)
            .options(*options)
            .limit(1)
        )
        if for_update:
            statement = statement.with_for_update(of=BenefitGrant).execution_options(
                populate_existing=True
            )
        return await self.get_one_or_none(statement)

    async def list_by_property_and_organization(
        self,
        organization_id: UUID,
        key: str,
        value: str,
        *,
        benefit_id: UUID | None = None,
        for_update: bool = False,
    ) -> Sequence[BenefitGrant]:
        filters = [
            BenefitGrant.properties[key].as_string() == value,
            Benefit.organization_id == organization_id,
        ]
        if benefit_id is not None:
            filters.append(BenefitGrant.benefit_id == benefit_id)

        statement = (
            self.get_base_statement()
            .join(Benefit, BenefitGrant.benefit_id == Benefit.id)
            .where(*filters)
            .order_by(BenefitGrant.id)
        )
        if for_update:
            statement = statement.with_for_update(of=BenefitGrant)
        return await self.get_all(statement)

    async def count_granted_by_property_and_organization(
        self,
        organization_id: UUID,
        key: str,
        value: str,
    ) -> int:
        statement = (
            select(func.count(BenefitGrant.id))
            .join(Benefit, BenefitGrant.benefit_id == Benefit.id)
            .where(
                BenefitGrant.properties[key].as_string() == value,
                Benefit.organization_id == organization_id,
                BenefitGrant.is_granted,
                ~BenefitGrant.is_deleted,
            )
        )
        result = await self.session.execute(statement)
        return result.scalar_one()

    async def list_outdated_grants(
        self,
        product: Product,
        *,
        member_id: UUID | None = None,
        **scope: Unpack[BenefitGrantScope],
    ) -> Sequence[BenefitGrant]:
        product_benefits_statement = (
            select(Benefit.id)
            .join(ProductBenefit)
            .where(ProductBenefit.product_id == product.id)
        )
        statement = self.get_base_statement().where(
            BenefitGrant.scope == scope,
            BenefitGrant.benefit_id.not_in(product_benefits_statement),
            ~BenefitGrant.is_revoked,
            ~BenefitGrant.is_deleted,
        )
        if member_id is not None:
            statement = statement.where(BenefitGrant.member_id == member_id)
        return await self.get_all(statement)

    async def list_unrevoked_by_benefit(
        self, benefit_id: UUID
    ) -> Sequence[BenefitGrant]:
        statement = self.get_base_statement().where(
            BenefitGrant.benefit_id == benefit_id, ~BenefitGrant.is_revoked
        )
        return await self.get_all(statement)

    async def list_unrevoked_by_customer(
        self, customer_id: UUID
    ) -> Sequence[BenefitGrant]:
        statement = self.get_base_statement().where(
            BenefitGrant.customer_id == customer_id, ~BenefitGrant.is_revoked
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

    def get_eager_options(self) -> Options:
        return (
            joinedload(BenefitGrant.customer),
            joinedload(BenefitGrant.benefit).joinedload(Benefit.organization),
            joinedload(BenefitGrant.member),
        )
