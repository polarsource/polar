from fastapi import Depends, Query
from pydantic import UUID4

from polar.customer.schemas.customer import CustomerID
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.metadata import MetadataQuery, get_metadata_query_openapi_schema
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.models import Benefit
from polar.models.benefit import BenefitType
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.redis import Redis, get_redis
from polar.routing import APIRouter

from . import auth, sorting
from .grant.service import benefit_grant as benefit_grant_service
from .schemas import Benefit as BenefitSchema
from .schemas import (
    BenefitCreate,
    BenefitGrant,
    BenefitID,
    BenefitUpdate,
    benefit_schema_map,
)
from .service import benefit as benefit_service

router = APIRouter(prefix="/benefits", tags=["benefits", APITag.public])

BenefitNotFound = {
    "description": "Benefit not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/",
    summary="List Benefits",
    response_model=ListResource[BenefitSchema],
    openapi_extra={"parameters": [get_metadata_query_openapi_schema()]},
)
async def list(
    auth_subject: auth.BenefitsRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    metadata: MetadataQuery,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    type: MultipleQueryFilter[BenefitType] | None = Query(
        None, title="BenefitType Filter", description="Filter by benefit type."
    ),
    id: MultipleQueryFilter[BenefitID] | None = Query(
        None, title="Filter IDs", description="Filter by benefit IDs."
    ),
    exclude_id: MultipleQueryFilter[BenefitID] | None = Query(
        None, title="Exclude IDs", description="Exclude benefits with these IDs."
    ),
    session: AsyncSession = Depends(get_db_session),
    query: str | None = Query(
        None, title="Query", description="Filter by description."
    ),
) -> ListResource[BenefitSchema]:
    """List benefits."""
    results, count = await benefit_service.list(
        session,
        auth_subject,
        type=type,
        organization_id=organization_id,
        id_in=id,
        id_not_in=exclude_id,
        metadata=metadata,
        query=query,
        pagination=pagination,
        sorting=sorting,
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
    benefit = await benefit_service.get(session, auth_subject, id)

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
    customer_id: MultipleQueryFilter[CustomerID] | None = Query(
        None, title="CustomerID Filter", description="Filter by customer."
    ),
    member_id: MultipleQueryFilter[UUID4] | None = Query(
        None, title="MemberID Filter", description="Filter by member."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[BenefitGrant]:
    """
    List the individual grants for a benefit.

    It's especially useful to check if a user has been granted a benefit.
    """
    benefit = await benefit_service.get(session, auth_subject, id)

    if benefit is None:
        raise ResourceNotFound()

    results, count = await benefit_grant_service.list(
        session,
        benefit,
        is_granted=is_granted,
        customer_id=customer_id,
        member_id=member_id,
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
    benefit_create: BenefitCreate,
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> Benefit:
    """
    Create a benefit.
    """
    benefit = await benefit_service.user_create(
        session, redis, benefit_create, auth_subject
    )

    return benefit


@router.patch(
    "/{id}",
    summary="Update Benefit",
    response_model=BenefitSchema,
    responses={
        200: {"description": "Benefit updated."},
        404: BenefitNotFound,
    },
)
async def update(
    id: BenefitID,
    benefit_update: BenefitUpdate,
    auth_subject: auth.BenefitsWrite,
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> Benefit:
    """
    Update a benefit.
    """
    benefit = await benefit_service.get(session, auth_subject, id)

    if benefit is None:
        raise ResourceNotFound()

    return await benefit_service.update(
        session, redis, benefit, benefit_update, auth_subject
    )


@router.delete(
    "/{id}",
    summary="Delete Benefit",
    status_code=204,
    responses={
        204: {"description": "Benefit deleted."},
        403: {
            "description": "This benefit is not deletable.",
            "model": NotPermitted.schema(),
        },
        404: BenefitNotFound,
    },
)
async def delete(
    id: BenefitID,
    auth_subject: auth.BenefitsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """
    Delete a benefit.

    > [!WARNING]
    > Every grants associated with the benefit will be revoked.
    > Users will lose access to the benefit.
    """
    benefit = await benefit_service.get(session, auth_subject, id)

    if benefit is None:
        raise ResourceNotFound()

    await benefit_service.delete(session, benefit)
