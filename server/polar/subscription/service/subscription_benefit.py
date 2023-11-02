import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import Select, delete, or_, select
from sqlalchemy.exc import InvalidRequestError
from sqlalchemy.orm import aliased, contains_eager

from polar.authz.service import AccessType, Authz
from polar.exceptions import NotPermitted, PolarError
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceService
from polar.kit.utils import utc_now
from polar.models import (
    Organization,
    Repository,
    SubscriptionBenefit,
    SubscriptionTierBenefit,
    User,
    UserOrganization,
)
from polar.models.subscription_benefit import SubscriptionBenefitType
from polar.organization.service import organization as organization_service
from polar.repository.service import repository as repository_service

from ..schemas import (
    SubscriptionBenefitCreate,
    SubscriptionBenefitUpdate,
)
from .subscription_benefit_grant import (
    subscription_benefit_grant as subscription_benefit_grant_service,
)


class SubscriptionBenefitError(PolarError):
    ...


class OrganizationDoesNotExist(SubscriptionBenefitError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        message = f"Organization with id {organization_id} does not exist."
        super().__init__(message, 422)


class RepositoryDoesNotExist(SubscriptionBenefitError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        message = f"Repository with id {organization_id} does not exist."
        super().__init__(message, 422)


class SubscriptionBenefitService(
    ResourceService[
        SubscriptionBenefit, SubscriptionBenefitCreate, SubscriptionBenefitUpdate
    ]
):
    async def search(
        self,
        session: AsyncSession,
        user: User,
        *,
        type: SubscriptionBenefitType | None = None,
        organization: Organization | None = None,
        repository: Repository | None = None,
        direct_organization: bool = True,
        pagination: PaginationParams,
    ) -> tuple[Sequence[SubscriptionBenefit], int]:
        statement = self._get_readable_subscription_benefit_statement(user)

        if type is not None:
            statement = statement.where(SubscriptionBenefit.type == type)

        if organization is not None:
            clauses = [SubscriptionBenefit.organization_id == organization.id]
            if not direct_organization:
                clauses.append(Repository.organization_id == organization.id)
            statement = statement.where(or_(*clauses))

        if repository is not None:
            statement = statement.where(
                SubscriptionBenefit.repository_id == repository.id
            )

        statement = statement.order_by(
            SubscriptionBenefit.type,
            SubscriptionBenefit.created_at,
        )

        results, count = await paginate(session, statement, pagination=pagination)

        return results, count

    async def get_by_id(
        self, session: AsyncSession, user: User, id: uuid.UUID
    ) -> SubscriptionBenefit | None:
        statement = (
            self._get_readable_subscription_benefit_statement(user)
            .where(
                SubscriptionBenefit.id == id, SubscriptionBenefit.deleted_at.is_(None)
            )
            .options(
                contains_eager(SubscriptionBenefit.organization),
                contains_eager(SubscriptionBenefit.repository),
            )
        )

        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def user_create(
        self,
        session: AsyncSession,
        authz: Authz,
        create_schema: SubscriptionBenefitCreate,
        user: User,
    ) -> SubscriptionBenefit:
        organization: Organization | None = None
        repository: Repository | None = None
        if create_schema.organization_id is not None:
            organization = await organization_service.get(
                session, create_schema.organization_id
            )
            if organization is None or not await authz.can(
                user, AccessType.write, organization
            ):
                raise OrganizationDoesNotExist(create_schema.organization_id)

        if create_schema.repository_id is not None:
            repository = await repository_service.get(
                session, create_schema.repository_id
            )
            if repository is None or not await authz.can(
                user, AccessType.write, repository
            ):
                raise RepositoryDoesNotExist(create_schema.repository_id)

        return await self.model.create(
            session,
            organization=organization,
            repository=repository,
            **create_schema.dict(exclude={"organization_id", "repository_id"}),
        )

    async def user_update(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription_benefit: SubscriptionBenefit,
        update_schema: SubscriptionBenefitUpdate,
        user: User,
    ) -> SubscriptionBenefit:
        subscription_benefit = await self._with_organization_or_repository(
            session, subscription_benefit
        )

        if not await authz.can(user, AccessType.write, subscription_benefit):
            raise NotPermitted()

        updated_subscription_benefit = await subscription_benefit.update(
            session, **update_schema.dict(exclude_unset=True)
        )

        await subscription_benefit_grant_service.enqueue_benefit_grant_updates(
            session, updated_subscription_benefit, update_schema
        )

        return updated_subscription_benefit

    async def user_delete(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription_benefit: SubscriptionBenefit,
        user: User,
    ) -> SubscriptionBenefit:
        subscription_benefit = await self._with_organization_or_repository(
            session, subscription_benefit
        )

        if not await authz.can(user, AccessType.write, subscription_benefit):
            raise NotPermitted()

        subscription_benefit.deleted_at = utc_now()
        session.add(subscription_benefit)
        statement = delete(SubscriptionTierBenefit).where(
            SubscriptionTierBenefit.subscription_benefit_id == subscription_benefit.id
        )
        await session.execute(statement)
        await session.commit()

        await subscription_benefit_grant_service.enqueue_benefit_grant_deletions(
            session, subscription_benefit
        )

        return subscription_benefit

    async def _with_organization_or_repository(
        self, session: AsyncSession, subscription_benefit: SubscriptionBenefit
    ) -> SubscriptionBenefit:
        try:
            subscription_benefit.organization
            subscription_benefit.repository
        except InvalidRequestError:
            await session.refresh(subscription_benefit, {"organization", "repository"})
        return subscription_benefit

    def _get_readable_subscription_benefit_statement(self, user: User) -> Select[Any]:
        RepositoryOrganization = aliased(Organization)
        RepositoryUserOrganization = aliased(UserOrganization)

        return (
            select(SubscriptionBenefit)
            .join(SubscriptionBenefit.organization, full=True)
            .join(SubscriptionBenefit.repository, full=True)
            .join(
                UserOrganization,
                onclause=UserOrganization.organization_id
                == SubscriptionBenefit.organization_id,
                full=True,
            )
            .join(
                RepositoryOrganization,
                onclause=RepositoryOrganization.id == Repository.organization_id,
                full=True,
            )
            .join(
                RepositoryUserOrganization,
                onclause=RepositoryUserOrganization.organization_id
                == RepositoryOrganization.id,
                full=True,
            )
            .where(
                # Prevent to return `None` objects due to the full outer join
                SubscriptionBenefit.id.is_not(None),
                SubscriptionBenefit.deleted_at.is_(None),
                or_(
                    UserOrganization.user_id == user.id,
                    RepositoryUserOrganization.user_id == user.id,
                ),
            )
        )


subscription_benefit = SubscriptionBenefitService(SubscriptionBenefit)
