from fastapi import Body, Depends, Query
from pydantic import UUID4

from polar.authz.service import Authz
from polar.exceptions import BadRequest, NotPermitted, ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.models import Benefit
from polar.models.benefit import BenefitType
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.posthog import posthog
from polar.routing import APIRouter

from . import auth
from .schemas import Benefit as BenefitSchema
from .schemas import (
    BenefitCreate,
    BenefitGrant,
    BenefitID,
    BenefitUpdate,
    benefit_schema_map,
)
from .service.benefit import benefit as benefit_service
from .service.benefit_grant import benefit_grant as benefit_grant_service

router = APIRouter(prefix="/benefits", tags=["benefits", APITag.documented])

BenefitNotFound = {
    "description": "Benefit not found.",
    "model": ResourceNotFound.schema(),
}


@router.get("/", summary="List Benefits", response_model=ListResource[BenefitSchema])
async def list(
    auth_subject: auth.BenefitsRead,
    pagination: PaginationParamsQuery,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    type: MultipleQueryFilter[BenefitType] | None = Query(
        None, title="BenefitType Filter", description="Filter by benefit type."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[BenefitSchema]:
    """List benefits."""
    results, count = await benefit_service.list(
        session,
        auth_subject,
        type=type,
        organization_id=organization_id,
        pagination=pagination,
    )

    return ListResource.from_paginated_results(
        [benefit_schema_map[result.type].model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Benefit",
    response_model=BenefitSchema,
    responses={404: BenefitNotFound},
)
async def get(
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
    summary="List Benefit Grants",
    response_model=ListResource[BenefitGrant],
    responses={404: BenefitNotFound},
)
async def grants(
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
    summary="Create Benefit",
    response_model=BenefitSchema,
    status_code=201,
    responses={201: {"description": "Benefit created."}},
)
async def create(
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


@router.patch(
    "/{id}",
    summary="Update Benefit",
    response_model=BenefitSchema,
    responses={
        200: {"description": "Benefit updated."},
        403: {
            "description": "You don't have the permission to update this benefit.",
            "model": NotPermitted.schema(),
        },
        404: BenefitNotFound,
    },
)
async def update(
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
    summary="Delete Benefit",
    status_code=204,
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
async def delete(
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
