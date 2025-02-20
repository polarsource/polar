import uuid
from collections.abc import Sequence
from enum import StrEnum
from typing import Any, cast

from sqlalchemy import Select, UnaryExpression, asc, desc, or_, select
from sqlalchemy.orm import contains_eager, joinedload

from polar.auth.models import AuthSubject
from polar.customer.service import customer as customer_service
from polar.exceptions import NotPermitted, PolarRequestValidationError
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.kit.sorting import Sorting
from polar.models import (
    Benefit,
    BenefitGrant,
    Customer,
    Order,
    Organization,
    Subscription,
)
from polar.models.benefit import BenefitType
from polar.worker import enqueue_job

from ..schemas.benefit_grant import (
    CustomerBenefitGrantDiscordUpdate,
    CustomerBenefitGrantGitHubRepositoryUpdate,
    CustomerBenefitGrantUpdate,
)


class CustomerBenefitGrantSortProperty(StrEnum):
    granted_at = "granted_at"
    type = "type"
    organization = "organization"


class CustomerBenefitGrantService(ResourceServiceReader[BenefitGrant]):
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Customer],
        *,
        type: Sequence[BenefitType] | None = None,
        benefit_id: Sequence[uuid.UUID] | None = None,
        organization_id: Sequence[uuid.UUID] | None = None,
        checkout_id: Sequence[uuid.UUID] | None = None,
        order_id: Sequence[uuid.UUID] | None = None,
        subscription_id: Sequence[uuid.UUID] | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[CustomerBenefitGrantSortProperty]] = [
            (CustomerBenefitGrantSortProperty.granted_at, True)
        ],
    ) -> tuple[Sequence[BenefitGrant], int]:
        statement = self._get_readable_benefit_grant_statement(auth_subject).options(
            joinedload(BenefitGrant.customer)
        )

        if type is not None:
            statement = statement.where(Benefit.type.in_(type))

        if benefit_id is not None:
            statement = statement.where(BenefitGrant.benefit_id.in_(benefit_id))

        if organization_id is not None:
            statement = statement.where(Benefit.organization_id.in_(organization_id))

        if checkout_id is not None:
            statement = (
                statement.join(
                    Subscription,
                    onclause=Subscription.id == BenefitGrant.subscription_id,
                    isouter=True,
                )
                .join(
                    Order,
                    onclause=Order.id == BenefitGrant.order_id,
                    isouter=True,
                )
                .where(
                    or_(
                        Subscription.checkout_id.in_(checkout_id),
                        Order.checkout_id.in_(checkout_id),
                    )
                )
            )

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
        auth_subject: AuthSubject[Customer],
        id: uuid.UUID,
    ) -> BenefitGrant | None:
        statement = (
            self._get_readable_benefit_grant_statement(auth_subject)
            .where(BenefitGrant.id == id)
            .options(joinedload(BenefitGrant.customer))
        )

        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def update(
        self,
        session: AsyncSession,
        benefit_grant: BenefitGrant,
        benefit_grant_update: CustomerBenefitGrantUpdate,
    ) -> BenefitGrant:
        if benefit_grant.is_revoked:
            raise NotPermitted("Cannot update a revoked benefit grant.")

        if benefit_grant_update.benefit_type != benefit_grant.benefit.type:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "benefit_type"),
                        "msg": "Benefit type must match the existing granted benefit type.",
                        "input": benefit_grant_update.benefit_type,
                    }
                ]
            )

        if isinstance(
            benefit_grant_update, CustomerBenefitGrantDiscordUpdate
        ) or isinstance(
            benefit_grant_update, CustomerBenefitGrantGitHubRepositoryUpdate
        ):
            account_id = benefit_grant_update.properties["account_id"]
            platform = benefit_grant_update.get_oauth_platform()

            customer = await customer_service.get(session, benefit_grant.customer_id)
            assert customer is not None

            oauth_account = customer.get_oauth_account(account_id, platform)
            if oauth_account is None:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "properties", "account_id"),
                            "msg": "OAuth account does not exist.",
                            "input": account_id,
                        }
                    ]
                )

            benefit_grant.properties = cast(
                Any,
                {
                    **benefit_grant.properties,
                    **benefit_grant_update.properties,
                },
            )

            enqueue_job("benefit.update", benefit_grant.id)

        for attr, value in benefit_grant_update.model_dump(
            exclude_unset=True, exclude={"properties", "benefit_type"}
        ).items():
            setattr(benefit_grant, attr, value)

        session.add(benefit_grant)
        return benefit_grant

    def _get_readable_benefit_grant_statement(
        self, auth_subject: AuthSubject[Customer]
    ) -> Select[tuple[BenefitGrant]]:
        return (
            select(BenefitGrant)
            .join(Benefit, onclause=Benefit.id == BenefitGrant.benefit_id)
            .join(Organization, onclause=Benefit.organization_id == Organization.id)
            .where(
                BenefitGrant.deleted_at.is_(None),
                BenefitGrant.is_revoked.is_(False),
                BenefitGrant.customer_id == auth_subject.subject.id,
            )
            .options(
                contains_eager(BenefitGrant.benefit).options(
                    contains_eager(Benefit.organization)
                ),
            )
        )


customer_benefit_grant = CustomerBenefitGrantService(BenefitGrant)
