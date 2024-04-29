import structlog
from fastapi import Body, Depends, Query
from pydantic import UUID4

from polar.authz.service import Authz
from polar.exceptions import BadRequest, ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.routing import APIRouter
from polar.models import Benefit
from polar.models.benefit import BenefitType
from polar.organization.dependencies import ResolvedOrganization
from polar.postgres import AsyncSession, get_db_session
from polar.posthog import posthog
from polar.tags.api import Tags

from ..subscription import auth
from .schemas import Benefit as BenefitSchema
from .schemas import BenefitCreate, BenefitUpdate, benefit_schema_map
from .service.benefit import benefit as benefit_service

log = structlog.get_logger()

router = APIRouter(prefix="/benefits", tags=["benefits"])


@router.get("/search", response_model=ListResource[BenefitSchema], tags=[Tags.PUBLIC])
async def search_benefits(
    auth_subject: auth.CreatorSubscriptionsRead,
    pagination: PaginationParamsQuery,
    organization: ResolvedOrganization,
    type: BenefitType | None = Query(None),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[BenefitSchema]:
    results, count = await benefit_service.search(
        session,
        auth_subject,
        type=type,
        organization=organization,
        pagination=pagination,
    )

    return ListResource.from_paginated_results(
        [benefit_schema_map[result.type].model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get("/lookup", response_model=BenefitSchema, tags=[Tags.PUBLIC])
async def lookup_benefit(
    benefit_id: UUID4,
    auth_subject: auth.CreatorSubscriptionsRead,
    session: AsyncSession = Depends(get_db_session),
) -> Benefit:
    benefit = await benefit_service.get_by_id(session, auth_subject, benefit_id)

    if benefit is None:
        raise ResourceNotFound()

    return benefit


@router.post("/", response_model=BenefitSchema, status_code=201, tags=[Tags.PUBLIC])
async def create_benefit(
    auth_subject: auth.CreatorSubscriptionsWrite,
    benefit_create: BenefitCreate = Body(..., discriminator="type"),
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> Benefit:
    benefit = await benefit_service.user_create(
        session, authz, benefit_create, auth_subject
    )

    posthog.auth_subject_event(
        auth_subject,
        "benefits",
        "api",
        "create",
        {"benefit_id": benefit.id},
    )

    return benefit


@router.post("/{id}", response_model=BenefitSchema, tags=[Tags.PUBLIC])
async def update_benefit(
    id: UUID4,
    benefit_update: BenefitUpdate,
    auth_subject: auth.CreatorSubscriptionsWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> Benefit:
    benefit = await benefit_service.get_by_id(session, auth_subject, id)

    if benefit is None:
        raise ResourceNotFound()

    if benefit_update.type != benefit.type:
        raise BadRequest("The type of a benefit can't be changed.")

    posthog.auth_subject_event(
        auth_subject,
        "benefits",
        "api",
        "update",
        {"benefit_id": benefit.id},
    )

    return await benefit_service.user_update(
        session, authz, benefit, benefit_update, auth_subject
    )


@router.delete("/{id}", status_code=204, tags=[Tags.PUBLIC])
async def delete_benefit(
    id: UUID4,
    auth_subject: auth.CreatorSubscriptionsWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    benefit = await benefit_service.get_by_id(session, auth_subject, id)

    if benefit is None:
        raise ResourceNotFound()

    posthog.auth_subject_event(
        auth_subject,
        "benefits",
        "api",
        "delete",
        {"benefit_id": benefit.id},
    )

    await benefit_service.user_delete(session, authz, benefit, auth_subject)
