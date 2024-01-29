import uuid
from collections.abc import Sequence
from typing import Any

from pydantic import BaseModel
from sqlalchemy import Select, delete, or_, select
from sqlalchemy.exc import InvalidRequestError
from sqlalchemy.orm import aliased, contains_eager, joinedload

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
from polar.models.subscription_benefit import (
    SubscriptionBenefitArticles,
    SubscriptionBenefitType,
)
from polar.organization.service import organization as organization_service
from polar.repository.service import repository as repository_service

from ..schemas import (
    SubscriptionBenefitCreate,
    SubscriptionBenefitUpdate,
)
from .benefits import (
    SubscriptionBenefitPropertiesValidationError,
    get_subscription_benefit_service,
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
    async def get(
        self,
        session: AsyncSession,
        id: uuid.UUID,
        allow_deleted: bool = False,
        loaded: bool = False,
    ) -> SubscriptionBenefit | None:
        query = select(SubscriptionBenefit).where(SubscriptionBenefit.id == id)
        if not allow_deleted:
            query = query.where(SubscriptionBenefit.deleted_at.is_(None))

        if loaded:
            query = query.options(
                joinedload(SubscriptionBenefit.organization),
                joinedload(SubscriptionBenefit.repository),
            )

        res = await session.execute(query)
        return res.scalars().unique().one_or_none()

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

        try:
            is_tax_applicable = getattr(create_schema, "is_tax_applicable")
        except AttributeError:
            is_tax_applicable = create_schema.type.is_tax_applicable()

        benefit_service = get_subscription_benefit_service(create_schema.type, session)
        try:
            properties = await benefit_service.validate_properties(
                user, create_schema.properties.model_dump(by_alias=True)
            )
        except SubscriptionBenefitPropertiesValidationError as e:
            raise e.to_request_validation_error(("body", create_schema.type))

        return await self.model.create(
            session,
            organization=organization,
            repository=repository,
            is_tax_applicable=is_tax_applicable,
            properties=properties,
            **create_schema.model_dump(
                by_alias=True,
                exclude={
                    "organization_id",
                    "repository_id",
                    "is_tax_applicable",
                    "properties",
                },
            ),
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

        update_dict = update_schema.model_dump(
            by_alias=True, exclude_unset=True, exclude={"type", "properties"}
        )

        properties_update: BaseModel | None = getattr(update_schema, "properties", None)
        if properties_update is not None:
            benefit_service = get_subscription_benefit_service(
                subscription_benefit.type, session
            )
            try:
                update_dict["properties"] = await benefit_service.validate_properties(
                    user, properties_update.model_dump(by_alias=True)
                )
            except SubscriptionBenefitPropertiesValidationError as e:
                raise e.to_request_validation_error(("body", subscription_benefit.type))

        previous_properties = subscription_benefit.properties

        updated_subscription_benefit = await subscription_benefit.update(
            session, **update_dict
        )

        await subscription_benefit_grant_service.enqueue_benefit_grant_updates(
            session, updated_subscription_benefit, previous_properties
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

        if not subscription_benefit.deletable:
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

    async def get_or_create_articles_benefits(
        self,
        session: AsyncSession,
        organization: Organization | None = None,
        repository: Repository | None = None,
    ) -> tuple[SubscriptionBenefitArticles, SubscriptionBenefitArticles]:
        statement = select(SubscriptionBenefitArticles)
        if organization is not None:
            statement = statement.where(
                SubscriptionBenefitArticles.organization_id == organization.id
            )
        if repository is not None:
            statement = statement.where(
                SubscriptionBenefitArticles.repository_id == repository.id
            )

        result = await session.execute(statement)

        public_articles: SubscriptionBenefitArticles | None = None
        premium_articles: SubscriptionBenefitArticles | None = None
        for benefit in result.scalars().all():
            if benefit.properties["paid_articles"]:
                premium_articles = benefit
            else:
                public_articles = benefit

        should_commit = False

        if public_articles is None:
            public_articles = SubscriptionBenefitArticles(
                description="Public posts",
                is_tax_applicable=False,
                selectable=False,
                deletable=False,
                properties={"paid_articles": False},
                organization=organization,
                repository=repository,
            )
            session.add(public_articles)
            should_commit = True

        if premium_articles is None:
            premium_articles = SubscriptionBenefitArticles(
                description="Premium posts",
                is_tax_applicable=True,
                selectable=True,
                deletable=False,
                properties={"paid_articles": True},
                organization=organization,
                repository=repository,
            )
            session.add(premium_articles)
            should_commit = True

        if should_commit:
            await session.commit()

        return (public_articles, premium_articles)

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
