import uuid
from collections.abc import Sequence

from pydantic import BaseModel
from sqlalchemy import case, delete

from polar.auth.models import AuthSubject
from polar.exceptions import NotPermitted, PolarRequestValidationError
from polar.kit.db.postgres import AsyncSession
from polar.kit.metadata import MetadataQuery, apply_metadata_clause
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.models import Benefit, Organization, ProductBenefit, User
from polar.models.benefit import BenefitType
from polar.models.webhook_endpoint import WebhookEventType
from polar.organization.resolver import get_payload_organization
from polar.redis import Redis
from polar.webhook.service import webhook as webhook_service
from polar.worker import enqueue_job

from .grant.service import benefit_grant as benefit_grant_service
from .registry import get_benefit_strategy
from .repository import BenefitRepository
from .schemas import BenefitCreate, BenefitUpdate
from .sorting import BenefitSortProperty


class BenefitService:
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        type: Sequence[BenefitType] | None = None,
        organization_id: Sequence[uuid.UUID] | None = None,
        id_in: Sequence[uuid.UUID] | None = None,
        id_not_in: Sequence[uuid.UUID] | None = None,
        metadata: MetadataQuery | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[BenefitSortProperty]] = [
            (BenefitSortProperty.created_at, True)
        ],
        query: str | None = None,
    ) -> tuple[Sequence[Benefit], int]:
        repository = BenefitRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject)

        if type is not None:
            statement = statement.where(Benefit.type.in_(type))

        if organization_id is not None:
            statement = statement.where(Benefit.organization_id.in_(organization_id))

        if id_in is not None:
            statement = statement.where(Benefit.id.in_(id_in))

        if id_not_in is not None:
            statement = statement.where(Benefit.id.notin_(id_not_in))

        if query is not None:
            statement = statement.where(Benefit.description.ilike(f"%{query}%"))

        if metadata is not None:
            statement = apply_metadata_clause(Benefit, statement, metadata)

        user_order_sorting = [
            s for s in sorting if s[0] == BenefitSortProperty.user_order
        ]
        other_sorting: list[Sorting[BenefitSortProperty]] = [
            s for s in sorting if s[0] != BenefitSortProperty.user_order
        ]

        if user_order_sorting and id_in:
            order_cases = {benefit_id: idx for idx, benefit_id in enumerate(id_in)}
            case_expression = case(order_cases, value=Benefit.id)
            _, is_desc = user_order_sorting[0]
            if is_desc:
                statement = statement.order_by(case_expression.desc())
            else:
                statement = statement.order_by(case_expression)

        if other_sorting:
            statement = repository.apply_sorting(statement, other_sorting)
        elif not user_order_sorting:
            statement = repository.apply_sorting(statement, sorting)

        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> Benefit | None:
        repository = BenefitRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .where(Benefit.id == id)
            .options(*repository.get_eager_options())
        )
        return await repository.get_one_or_none(statement)

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
            session, organization, WebhookEventType.benefit_created, benefit
        )

        return benefit

    async def update(
        self,
        session: AsyncSession,
        redis: Redis,
        benefit: Benefit,
        benefit_update: BenefitUpdate,
        auth_subject: AuthSubject[User | Organization],
    ) -> Benefit:
        if benefit_update.type != benefit.type:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "type"),
                        "msg": "Benefit type cannot be changed.",
                        "input": benefit.type,
                    }
                ]
            )

        update_dict = benefit_update.model_dump(
            by_alias=True, exclude_unset=True, exclude={"type", "properties"}
        )

        properties_update: BaseModel | None = getattr(
            benefit_update, "properties", None
        )
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
            session, benefit.organization, WebhookEventType.benefit_updated, benefit
        )

        return benefit

    async def delete(self, session: AsyncSession, benefit: Benefit) -> Benefit:
        if not benefit.deletable:
            raise NotPermitted()

        repository = BenefitRepository.from_session(session)
        await repository.soft_delete(benefit)
        statement = delete(ProductBenefit).where(
            ProductBenefit.benefit_id == benefit.id
        )
        await session.execute(statement)

        enqueue_job("benefit.delete", benefit_id=benefit.id)

        await webhook_service.send(
            session, benefit.organization, WebhookEventType.benefit_updated, benefit
        )

        return benefit


benefit = BenefitService()
