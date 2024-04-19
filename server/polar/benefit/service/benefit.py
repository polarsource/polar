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
    Benefit,
    Organization,
    Repository,
    SubscriptionTierBenefit,
    User,
    UserOrganization,
)
from polar.models.benefit import (
    BenefitArticles,
    BenefitType,
)
from polar.organization.service import organization as organization_service
from polar.repository.service import repository as repository_service
from polar.webhook.service import webhook_service
from polar.webhook.webhooks import WebhookEventType

from ..benefits import BenefitPropertiesValidationError, get_benefit_service
from ..schemas import BenefitCreate, BenefitUpdate
from .benefit_grant import benefit_grant as benefit_grant_service


class BenefitError(PolarError): ...


class OrganizationDoesNotExist(BenefitError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        message = f"Organization with id {organization_id} does not exist."
        super().__init__(message, 422)


class RepositoryDoesNotExist(BenefitError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        message = f"Repository with id {organization_id} does not exist."
        super().__init__(message, 422)


class BenefitService(ResourceService[Benefit, BenefitCreate, BenefitUpdate]):
    async def get(
        self,
        session: AsyncSession,
        id: uuid.UUID,
        allow_deleted: bool = False,
        loaded: bool = False,
    ) -> Benefit | None:
        query = select(Benefit).where(Benefit.id == id)
        if not allow_deleted:
            query = query.where(Benefit.deleted_at.is_(None))

        if loaded:
            query = query.options(
                joinedload(Benefit.organization),
                joinedload(Benefit.repository),
            )

        res = await session.execute(query)
        return res.scalars().unique().one_or_none()

    async def search(
        self,
        session: AsyncSession,
        user: User,
        *,
        type: BenefitType | None = None,
        organization: Organization | None = None,
        repository: Repository | None = None,
        direct_organization: bool = True,
        pagination: PaginationParams,
    ) -> tuple[Sequence[Benefit], int]:
        statement = self._get_readable_benefit_statement(user)

        if type is not None:
            statement = statement.where(Benefit.type == type)

        if organization is not None:
            clauses = [Benefit.organization_id == organization.id]
            if not direct_organization:
                clauses.append(Repository.organization_id == organization.id)
            statement = statement.where(or_(*clauses))

        if repository is not None:
            statement = statement.where(Benefit.repository_id == repository.id)

        statement = statement.order_by(
            Benefit.type,
            Benefit.created_at,
        )

        results, count = await paginate(session, statement, pagination=pagination)

        return results, count

    async def get_by_id(
        self, session: AsyncSession, user: User, id: uuid.UUID
    ) -> Benefit | None:
        statement = (
            self._get_readable_benefit_statement(user)
            .where(Benefit.id == id, Benefit.deleted_at.is_(None))
            .options(
                contains_eager(Benefit.organization),
                contains_eager(Benefit.repository),
            )
        )

        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def user_create(
        self,
        session: AsyncSession,
        authz: Authz,
        create_schema: BenefitCreate,
        user: User,
    ) -> Benefit:
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

        benefit_service = get_benefit_service(create_schema.type, session)
        try:
            properties = await benefit_service.validate_properties(
                user, create_schema.properties.model_dump(mode="json", by_alias=True)
            )
        except BenefitPropertiesValidationError as e:
            raise e.to_request_validation_error(("body", create_schema.type))

        benefit = Benefit(
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
        session.add(benefit)
        await session.flush()

        if organization:
            await webhook_service.send(
                session,
                target=organization,
                we=(WebhookEventType.benefit_created, benefit),
            )

        return benefit

    async def user_update(
        self,
        session: AsyncSession,
        authz: Authz,
        benefit: Benefit,
        update_schema: BenefitUpdate,
        user: User,
    ) -> Benefit:
        benefit = await self._with_organization_or_repository(session, benefit)

        if not await authz.can(user, AccessType.write, benefit):
            raise NotPermitted()

        update_dict = update_schema.model_dump(
            by_alias=True, exclude_unset=True, exclude={"type", "properties"}
        )

        properties_update: BaseModel | None = getattr(update_schema, "properties", None)
        if properties_update is not None:
            benefit_service = get_benefit_service(benefit.type, session)
            try:
                update_dict["properties"] = await benefit_service.validate_properties(
                    user, properties_update.model_dump(mode="json", by_alias=True)
                )
            except BenefitPropertiesValidationError as e:
                raise e.to_request_validation_error(("body", benefit.type))

        previous_properties = benefit.properties

        for key, value in update_dict.items():
            setattr(benefit, key, value)
        session.add(benefit)

        await benefit_grant_service.enqueue_benefit_grant_updates(
            session, benefit, previous_properties
        )

        if benefit.organization:
            await webhook_service.send(
                session,
                target=benefit.organization,
                we=(WebhookEventType.benefit_updated, benefit),
            )

        return benefit

    async def user_delete(
        self,
        session: AsyncSession,
        authz: Authz,
        benefit: Benefit,
        user: User,
    ) -> Benefit:
        benefit = await self._with_organization_or_repository(session, benefit)

        if not await authz.can(user, AccessType.write, benefit):
            raise NotPermitted()

        if not benefit.deletable:
            raise NotPermitted()

        benefit.deleted_at = utc_now()
        session.add(benefit)
        statement = delete(SubscriptionTierBenefit).where(
            SubscriptionTierBenefit.benefit_id == benefit.id
        )
        await session.execute(statement)

        await benefit_grant_service.enqueue_benefit_grant_deletions(session, benefit)

        if benefit.organization:
            await webhook_service.send(
                session,
                target=benefit.organization,
                we=(WebhookEventType.benefit_updated, benefit),
            )

        return benefit

    async def get_or_create_articles_benefits(
        self,
        session: AsyncSession,
        organization: Organization | None = None,
    ) -> tuple[BenefitArticles, BenefitArticles]:
        statement = select(BenefitArticles)
        if organization is not None:
            statement = statement.where(
                BenefitArticles.organization_id == organization.id
            )

        result = await session.execute(statement)

        public_articles: BenefitArticles | None = None
        premium_articles: BenefitArticles | None = None
        for benefit in result.scalars().all():
            if benefit.properties["paid_articles"]:
                premium_articles = benefit
            else:
                public_articles = benefit

        if public_articles is None:
            public_articles = BenefitArticles(
                description="Public posts",
                is_tax_applicable=False,
                selectable=False,
                deletable=False,
                properties={"paid_articles": False},
                organization=organization,
            )
            session.add(public_articles)

        if premium_articles is None:
            premium_articles = BenefitArticles(
                description="Premium posts",
                is_tax_applicable=True,
                selectable=True,
                deletable=False,
                properties={"paid_articles": True},
                organization=organization,
            )
            session.add(premium_articles)

        return (public_articles, premium_articles)

    async def _with_organization_or_repository(
        self, session: AsyncSession, benefit: Benefit
    ) -> Benefit:
        try:
            benefit.organization
            benefit.repository
        except InvalidRequestError:
            await session.refresh(benefit, {"organization", "repository"})
        return benefit

    def _get_readable_benefit_statement(self, user: User) -> Select[Any]:
        RepositoryOrganization = aliased(Organization)
        RepositoryUserOrganization = aliased(UserOrganization)

        return (
            select(Benefit)
            .join(Benefit.organization, full=True)
            .join(Benefit.repository, full=True)
            .join(
                UserOrganization,
                onclause=UserOrganization.organization_id == Benefit.organization_id,
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
                Benefit.id.is_not(None),
                Benefit.deleted_at.is_(None),
                or_(
                    UserOrganization.user_id == user.id,
                    RepositoryUserOrganization.user_id == user.id,
                ),
            )
        )


benefit = BenefitService(Benefit)
