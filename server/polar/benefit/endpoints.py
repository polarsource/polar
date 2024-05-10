from typing import Annotated

import structlog
from fastapi import Body, Depends, Path, Query
from pydantic import UUID4

from polar.authz.service import Authz
from polar.exceptions import BadRequest, NotPermitted, ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.routing import APIRouter
from polar.models import Benefit
from polar.models.benefit import BenefitType
from polar.organization.dependencies import ResolvedOrganization
from polar.postgres import AsyncSession, get_db_session
from polar.posthog import posthog
from polar.tags.api import Tags

from . import auth
from .schemas import Benefit as BenefitSchema
from .schemas import BenefitCreate, BenefitGrant, BenefitUpdate, benefit_schema_map
from .service.benefit import benefit as benefit_service
from .service.benefit_grant import benefit_grant as benefit_grant_service

log = structlog.get_logger()

router = APIRouter(prefix="/benefits", tags=["benefits"])

BenefitID = Annotated[UUID4, Path(description="The benefit ID")]
BenefitNotFound = {
    "description": "Benefit not found.",
    "model": ResourceNotFound.schema(),
}


@router.get("/", response_model=ListResource[BenefitSchema], tags=[Tags.PUBLIC])
async def list_benefits(
    auth_subject: auth.BenefitsRead,
    pagination: PaginationParamsQuery,
    organization: ResolvedOrganization,
    type: BenefitType | None = Query(
        None,
        description="Filter by benefit type.",
        examples=[BenefitType.github_repository],
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[BenefitSchema]:
    """List benefits created on an organization."""
    results, count = await benefit_service.list(
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


@router.get(
    "/{id}",
    response_model=BenefitSchema,
    tags=[Tags.PUBLIC],
    responses={404: BenefitNotFound},
)
async def get_benefit(
    id: BenefitID,
    auth_subject: auth.BenefitsRead,
    session: AsyncSession = Depends(get_db_session),
) -> Benefit:
    """Get a benefit by ID."""
    benefit = await benefit_service.get_by_id(session, auth_subject, id)

    if benefit is None:
        raise ResourceNotFound()

    return benefit


@router.get(
    "/{id}/grants",
    response_model=ListResource[BenefitGrant],
    tags=[Tags.PUBLIC],
    responses={404: BenefitNotFound},
)
async def list_benefit_grants(
    id: BenefitID,
    auth_subject: auth.BenefitsRead,
    pagination: PaginationParamsQuery,
    is_granted: bool | None = Query(
        None,
        description=(
            "Filter by granted status. "
            "If `true`, only granted benefits will be returned. "
            "If `false`, only revoked benefits will be returned. "
        ),
    ),
    user_id: UUID4 | None = Query(
        None,
        description=("Filter by user ID."),
    ),
    github_user_id: int | None = Query(
        None,
        description=(
            "Filter by GitHub user ID. "
            "Only available for users who have linked their GitHub account on Polar."
        ),
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[BenefitGrant]:
    """
    List the individual grants for a benefit.

    It's especially useful to check if a user has been granted a benefit.
    """
    benefit = await benefit_service.get_by_id(session, auth_subject, id)

    if benefit is None:
        raise ResourceNotFound()

    results, count = await benefit_grant_service.list(
        session,
        benefit,
        is_granted=is_granted,
        user_id=user_id,
        github_user_id=github_user_id,
        pagination=pagination,
    )

    return ListResource.from_paginated_results(
        [BenefitGrant.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.post(
    "/",
    response_model=BenefitSchema,
    status_code=201,
    tags=[Tags.PUBLIC],
    responses={201: {"description": "Benefit created."}},
)
async def create_benefit(
    auth_subject: auth.BenefitsWrite,
    benefit_create: BenefitCreate = Body(..., discriminator="type"),
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> Benefit:
    """
    Create a benefit.
    """
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


@router.post(
    "/{id}",
    response_model=BenefitSchema,
    tags=[Tags.PUBLIC],
    responses={
        200: {"description": "Benefit updated."},
        403: {
            "description": "You don't have the permission to update this benefit.",
            "model": NotPermitted.schema(),
        },
        404: BenefitNotFound,
    },
)
async def update_benefit(
    id: BenefitID,
    benefit_update: BenefitUpdate,
    auth_subject: auth.BenefitsWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> Benefit:
    """
    Update a benefit.
    """
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


@router.delete(
    "/{id}",
    status_code=204,
    tags=[Tags.PUBLIC],
    responses={
        204: {"description": "Benefit deleted."},
        403: {
            "description": (
                "You don't have the permission to update this benefit "
                "or it's not deletable."
            ),
            "model": NotPermitted.schema(),
        },
        404: BenefitNotFound,
    },
)
async def delete_benefit(
    id: BenefitID,
    auth_subject: auth.BenefitsWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """
    Delete a benefit.

    > [!WARNING]
    > Every grants associated with the benefit will be revoked.
    > Users will lose access to the benefit.
    """
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
