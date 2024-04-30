import uuid
from collections.abc import Sequence
from typing import Any

from pydantic import BaseModel
from sqlalchemy import Select, delete, select
from sqlalchemy.exc import InvalidRequestError
from sqlalchemy.orm import contains_eager, joinedload

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.authz.service import AccessType, Authz
from polar.exceptions import NotPermitted, PolarError
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceService
from polar.kit.utils import utc_now
from polar.models import (
    Benefit,
    Organization,
    SubscriptionTierBenefit,
    User,
    UserOrganization,
)
from polar.models.benefit import BenefitArticles, BenefitType
from polar.models.webhook_endpoint import WebhookEventType
from polar.organization.resolver import get_payload_organization
from polar.webhook.service import webhook_service

from ..benefits import BenefitPropertiesValidationError, get_benefit_service
from ..schemas import BenefitCreate, BenefitUpdate
from .benefit_grant import benefit_grant as benefit_grant_service


class BenefitError(PolarError): ...


class OrganizationDoesNotExist(BenefitError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        message = f"Organization with id {organization_id} does not exist."
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
            query = query.options(joinedload(Benefit.organization))

        res = await session.execute(query)
        return res.scalars().unique().one_or_none()

    async def search(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        type: BenefitType | None = None,
        organization: Organization | None = None,
        pagination: PaginationParams,
    ) -> tuple[Sequence[Benefit], int]:
        statement = self._get_readable_benefit_statement(auth_subject)

        if type is not None:
            statement = statement.where(Benefit.type == type)

        if organization is not None:
            statement = statement.where(Benefit.organization_id == organization.id)

        statement = statement.order_by(
            Benefit.type,
            Benefit.created_at,
        )

        results, count = await paginate(session, statement, pagination=pagination)

        return results, count

    async def get_by_id(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> Benefit | None:
        statement = (
            self._get_readable_benefit_statement(auth_subject)
            .where(Benefit.id == id, Benefit.deleted_at.is_(None))
            .options(contains_eager(Benefit.organization))
        )

        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def user_create(
        self,
        session: AsyncSession,
        authz: Authz,
        create_schema: BenefitCreate,
        auth_subject: AuthSubject[User | Organization],
    ) -> Benefit:
        subject = auth_subject.subject

        organization = await get_payload_organization(
            session, auth_subject, create_schema
        )
        if not await authz.can(subject, AccessType.write, organization):
            raise OrganizationDoesNotExist(organization.id)

        try:
            is_tax_applicable = getattr(create_schema, "is_tax_applicable")
        except AttributeError:
            is_tax_applicable = create_schema.type.is_tax_applicable()

        benefit_service = get_benefit_service(create_schema.type, session)
        try:
            properties = await benefit_service.validate_properties(
                auth_subject,
                create_schema.properties.model_dump(mode="json", by_alias=True),
            )
        except BenefitPropertiesValidationError as e:
            raise e.to_request_validation_error(("body", create_schema.type))

        benefit = Benefit(
            organization=organization,
            is_tax_applicable=is_tax_applicable,
            properties=properties,
            **create_schema.model_dump(
                by_alias=True,
                exclude={
                    "organization_id",
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
        auth_subject: AuthSubject[User | Organization],
    ) -> Benefit:
        benefit = await self._with_organization(session, benefit)

        if not await authz.can(auth_subject.subject, AccessType.write, benefit):
            raise NotPermitted()

        update_dict = update_schema.model_dump(
            by_alias=True, exclude_unset=True, exclude={"type", "properties"}
        )

        properties_update: BaseModel | None = getattr(update_schema, "properties", None)
        if properties_update is not None:
            benefit_service = get_benefit_service(benefit.type, session)
            try:
                update_dict["properties"] = await benefit_service.validate_properties(
                    auth_subject,
                    properties_update.model_dump(mode="json", by_alias=True),
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
        auth_subject: AuthSubject[User | Organization],
    ) -> Benefit:
        benefit = await self._with_organization(session, benefit)

        if not await authz.can(auth_subject.subject, AccessType.write, benefit):
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

    async def _with_organization(
        self, session: AsyncSession, benefit: Benefit
    ) -> Benefit:
        try:
            benefit.organization
        except InvalidRequestError:
            await session.refresh(benefit, {"organization"})
        return benefit

    def _get_readable_benefit_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[Any]:
        statement = (select(Benefit).join(Benefit.organization, full=True)).where(
            # Prevent to return `None` objects due to the full outer join
            Benefit.id.is_not(None),
            Benefit.deleted_at.is_(None),
        )

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.join(
                UserOrganization,
                onclause=UserOrganization.organization_id == Benefit.organization_id,
                full=True,
            ).where(
                UserOrganization.user_id == user.id,
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Benefit.organization_id == auth_subject.subject.id,
            )

        return statement


benefit = BenefitService(Benefit)
