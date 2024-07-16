import uuid
from collections.abc import Sequence
from enum import StrEnum
from typing import Any

from sqlalchemy import Select, UnaryExpression, asc, desc, select
from sqlalchemy.orm import selectinload

from polar.auth.models import AuthSubject
from polar.exceptions import PolarError
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.kit.sorting import Sorting
from polar.models import (
    Benefit,
    BenefitGrant,
    Organization,
    User,
)
from polar.models.benefit import BenefitType


class UserBenefitError(PolarError): ...


class SortProperty(StrEnum):
    granted_at = "granted_at"
    type = "type"
    organization = "organization"


class UserBenefitService(ResourceServiceReader[Benefit]):
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        *,
        type: Sequence[BenefitType] | None = None,
        organization_id: Sequence[uuid.UUID] | None = None,
        order_id: Sequence[uuid.UUID] | None = None,
        subscription_id: Sequence[uuid.UUID] | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[SortProperty]] = [(SortProperty.granted_at, True)],
    ) -> tuple[Sequence[Benefit], int]:
        statement = self._get_readable_benefit_statement(auth_subject)

        if type is not None:
            statement = statement.where(Benefit.type.in_(type))

        if organization_id is not None:
            statement = statement.where(Benefit.organization_id.in_(organization_id))

        if order_id is not None:
            statement = statement.where(
                Benefit.id.in_(
                    select(BenefitGrant.benefit_id).where(
                        BenefitGrant.order_id.in_(order_id)
                    )
                )
            )

        if subscription_id is not None:
            statement = statement.where(
                Benefit.id.in_(
                    select(BenefitGrant.benefit_id).where(
                        BenefitGrant.subscription_id.in_(subscription_id)
                    )
                )
            )

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == SortProperty.granted_at:
                # Join only the most recent/oldest grant
                statement = statement.join(
                    BenefitGrant,
                    onclause=BenefitGrant.id
                    == select(BenefitGrant)
                    .correlate(Benefit)
                    .with_only_columns(BenefitGrant.id)
                    .where(
                        BenefitGrant.benefit_id == Benefit.id,
                        BenefitGrant.is_granted.is_(True),
                    )
                    .order_by(clause_function(BenefitGrant.granted_at))
                    .limit(1)
                    .scalar_subquery(),
                )
                order_by_clauses.append(clause_function(BenefitGrant.granted_at))
            elif criterion == SortProperty.type:
                order_by_clauses.append(clause_function(Benefit.type))
            elif criterion == SortProperty.organization:
                statement = statement.join(
                    Organization, onclause=Benefit.organization_id == Organization.id
                )
                order_by_clauses.append(clause_function(Organization.slug))
        statement = statement.order_by(*order_by_clauses)

        return await paginate(session, statement, pagination=pagination)

    async def get_by_id(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        id: uuid.UUID,
    ) -> Benefit | None:
        statement = self._get_readable_benefit_statement(auth_subject).where(
            Benefit.id == id
        )

        result = await session.execute(statement)
        return result.scalar_one_or_none()

    def _get_readable_benefit_statement(
        self, auth_subject: AuthSubject[User]
    ) -> Select[tuple[Benefit]]:
        statement = (
            select(Benefit)
            .where(
                Benefit.deleted_at.is_(None),
                Benefit.id.in_(
                    select(BenefitGrant.benefit_id).where(
                        BenefitGrant.user_id == auth_subject.subject.id,
                        BenefitGrant.is_granted.is_(True),
                    )
                ),
            )
            .options(
                selectinload(
                    Benefit.grants.and_(
                        BenefitGrant.user_id == auth_subject.subject.id,
                        BenefitGrant.is_granted.is_(True),
                    )
                )
            )
        )
        return statement


user_benefit = UserBenefitService(Benefit)
