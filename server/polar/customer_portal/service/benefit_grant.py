import uuid
from collections.abc import Sequence
from enum import StrEnum
from typing import Any

from sqlalchemy import Select, UnaryExpression, asc, desc, select
from sqlalchemy.orm import contains_eager

from polar.auth.models import AuthSubject, is_customer, is_user
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.kit.sorting import Sorting
from polar.models import (
    Benefit,
    BenefitGrant,
    Customer,
    Organization,
    User,
)
from polar.models.benefit import BenefitType


class CustomerBenefitGrantSortProperty(StrEnum):
    granted_at = "granted_at"
    type = "type"
    organization = "organization"


class CustomerBenefitGrantService(ResourceServiceReader[BenefitGrant]):
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Customer],
        *,
        type: Sequence[BenefitType] | None = None,
        benefit_id: Sequence[uuid.UUID] | None = None,
        organization_id: Sequence[uuid.UUID] | None = None,
        order_id: Sequence[uuid.UUID] | None = None,
        subscription_id: Sequence[uuid.UUID] | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[CustomerBenefitGrantSortProperty]] = [
            (CustomerBenefitGrantSortProperty.granted_at, True)
        ],
    ) -> tuple[Sequence[BenefitGrant], int]:
        statement = self._get_readable_benefit_grant_statement(auth_subject)

        if type is not None:
            statement = statement.where(Benefit.type.in_(type))

        if benefit_id is not None:
            statement = statement.where(BenefitGrant.benefit_id.in_(benefit_id))

        if organization_id is not None:
            statement = statement.where(Benefit.organization_id.in_(organization_id))

        if order_id is not None:
            statement = statement.where(BenefitGrant.order_id.in_(order_id))

        if subscription_id is not None:
            statement = statement.where(
                BenefitGrant.subscription_id.in_(subscription_id)
            )

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == CustomerBenefitGrantSortProperty.granted_at:
                order_by_clauses.append(clause_function(BenefitGrant.granted_at))
            elif criterion == CustomerBenefitGrantSortProperty.type:
                order_by_clauses.append(clause_function(Benefit.type))
            elif criterion == CustomerBenefitGrantSortProperty.organization:
                order_by_clauses.append(clause_function(Organization.slug))
        statement = statement.order_by(*order_by_clauses)

        return await paginate(session, statement, pagination=pagination)

    async def get_by_id(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Customer],
        id: uuid.UUID,
    ) -> BenefitGrant | None:
        statement = self._get_readable_benefit_grant_statement(auth_subject).where(
            BenefitGrant.id == id
        )

        result = await session.execute(statement)
        return result.scalar_one_or_none()

    def _get_readable_benefit_grant_statement(
        self, auth_subject: AuthSubject[User | Customer]
    ) -> Select[tuple[BenefitGrant]]:
        statement = (
            select(BenefitGrant)
            .join(Benefit, onclause=Benefit.id == BenefitGrant.benefit_id)
            .join(Organization, onclause=Benefit.organization_id == Organization.id)
            .where(
                BenefitGrant.deleted_at.is_(None),
            )
            .options(
                contains_eager(BenefitGrant.benefit).options(
                    contains_eager(Benefit.organization)
                ),
            )
        )

        if is_user(auth_subject):
            raise NotImplementedError("TODO")
        elif is_customer(auth_subject):
            statement = statement.where(
                BenefitGrant.customer_id == auth_subject.subject.id
            )

        return statement


customer_benefit_grant = CustomerBenefitGrantService(BenefitGrant)
