import uuid
from collections.abc import Sequence
from typing import Any, TypeVar, overload

from pydantic import BaseModel
from sqlalchemy import Select, UnaryExpression, asc, delete, desc, select
from sqlalchemy.exc import InvalidRequestError
from sqlalchemy.orm import contains_eager, joinedload

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.authz.service import AccessType, Authz
from polar.benefit.sorting import BenefitSortProperty
from polar.exceptions import NotPermitted, PolarError
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceService
from polar.kit.sorting import Sorting
from polar.kit.utils import utc_now
from polar.models import (
    Benefit,
    Organization,
    ProductBenefit,
    User,
    UserOrganization,
)
from polar.models.benefit import BenefitType
from polar.models.webhook_endpoint import WebhookEventType
from polar.organization.resolver import get_payload_organization
from polar.postgres import sql
from polar.redis import Redis
from polar.webhook.service import webhook as webhook_service
from polar.worker import enqueue_job

from .grant.service import benefit_grant as benefit_grant_service
from .schemas import BenefitCreate, BenefitUpdate
from .strategies import get_benefit_strategy

B = TypeVar("B", bound=Benefit)


class BenefitError(PolarError): ...


class BenefitService(ResourceService[Benefit, BenefitCreate, BenefitUpdate]):
    @overload
    async def get(
        self,
        session: AsyncSession,
        id: uuid.UUID,
        allow_deleted: bool = False,
        loaded: bool = False,
        *,
        class_: None = None,
        options: Sequence[sql.ExecutableOption] | None = None,
    ) -> Benefit | None: ...

    @overload
    async def get(
        self,
        session: AsyncSession,
        id: uuid.UUID,
        allow_deleted: bool = False,
        loaded: bool = False,
        *,
        class_: type[B] | None = None,
        options: Sequence[sql.ExecutableOption] | None = None,
    ) -> B | None: ...

    async def get(
        self,
        session: AsyncSession,
        id: uuid.UUID,
        allow_deleted: bool = False,
        loaded: bool = False,
        *,
        class_: Any = None,
        options: Sequence[sql.ExecutableOption] | None = None,
    ) -> Any | None:
        if class_ is None:
            class_ = Benefit

        query = select(class_).where(class_.id == id)
        if not allow_deleted:
            query = query.where(class_.deleted_at.is_(None))

        if loaded:
            query = query.options(joinedload(class_.organization))

        if options is not None:
            query = query.options(*options)

        res = await session.execute(query)
        return res.scalar_one_or_none()

    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        type: Sequence[BenefitType] | None = None,
        organization_id: Sequence[uuid.UUID] | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[BenefitSortProperty]] = [
            (BenefitSortProperty.created_at, True)
        ],
        query: str | None = None,
    ) -> tuple[Sequence[Benefit], int]:
        statement = self._get_readable_benefit_statement(auth_subject)

        if type is not None:
            statement = statement.where(Benefit.type.in_(type))

        if organization_id is not None:
            statement = statement.where(Benefit.organization_id.in_(organization_id))

        if query is not None:
            statement = statement.where(Benefit.description.ilike(f"%{query}%"))

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == BenefitSortProperty.created_at:
                order_by_clauses.append(clause_function(Benefit.created_at))
            elif criterion == BenefitSortProperty.description:
                order_by_clauses.append(clause_function(Benefit.description))
        statement = statement.order_by(*order_by_clauses)

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
        redis: Redis,
        create_schema: BenefitCreate,
        auth_subject: AuthSubject[User | Organization],
    ) -> Benefit:
        organization = await get_payload_organization(
            session, auth_subject, create_schema
        )

        try:
            is_tax_applicable = getattr(create_schema, "is_tax_applicable")
        except AttributeError:
            is_tax_applicable = create_schema.type.is_tax_applicable()

        benefit_strategy = get_benefit_strategy(create_schema.type, session, redis)
        properties = await benefit_strategy.validate_properties(
            auth_subject,
            create_schema.properties.model_dump(mode="json", by_alias=True),
        )

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

        await webhook_service.send(
            session,
            target=organization,
            we=(WebhookEventType.benefit_created, benefit),
        )

        return benefit

    async def user_update(
        self,
        session: AsyncSession,
        redis: Redis,
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
            benefit_strategy = get_benefit_strategy(benefit.type, session, redis)
            update_dict["properties"] = await benefit_strategy.validate_properties(
                auth_subject,
                properties_update.model_dump(mode="json", by_alias=True),
            )

        previous_properties = benefit.properties

        for key, value in update_dict.items():
            setattr(benefit, key, value)
        session.add(benefit)

        await benefit_grant_service.enqueue_benefit_grant_updates(
            session, redis, benefit, previous_properties
        )

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
        statement = delete(ProductBenefit).where(
            ProductBenefit.benefit_id == benefit.id
        )
        await session.execute(statement)

        enqueue_job("benefit.delete", benefit_id=benefit.id)

        await webhook_service.send(
            session,
            target=benefit.organization,
            we=(WebhookEventType.benefit_updated, benefit),
        )

        return benefit

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
