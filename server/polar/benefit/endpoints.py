from typing import Annotated

from fastapi import Depends, Query

from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.metadata import MetadataQuery, get_metadata_query_openapi_schema
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import Benefit
from polar.models.benefit import BenefitType
from polar.openapi import APITag, cli_preview, destructive
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.redis import Redis, get_redis
from polar.routing import APIRouter

from . import auth, sorting
from .grant.service import benefit_grant as benefit_grant_service
from .schemas import Benefit as BenefitSchema
from .schemas import (
    BenefitCreate,
    BenefitGrant,
    BenefitGrantsParams,
    BenefitID,
    BenefitListParams,
    BenefitUpdate,
    benefit_schema_map,
)
from .service import benefit as benefit_service
from .strategies.downloadables.schemas import BenefitDownloadableFile
from .strategies.downloadables.service import (
    benefit_downloadable_file as benefit_downloadable_file_service,
)

router = APIRouter(
    prefix="/benefits", tags=["benefits", APITag.public, APITag.mcp, APITag.cli]
)

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
    filters: Annotated[BenefitListParams, Query()],
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[BenefitSchema]:
    """List benefits."""
    results, count = await benefit_service.list(
        session,
        auth_subject,
        type=filters.type,
        organization_id=filters.organization_id,
        id_in=filters.id,
        id_not_in=filters.exclude_id,
        external_id=filters.external_id,
        metadata=metadata,
        query=filters.query,
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
    openapi_extra=cli_preview(
        ("id", "ID"), ("type", "Type"), ("description", "Description")
    ),
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
    "/{id}/files",
    summary="List Benefit Files",
    response_model=ListResource[BenefitDownloadableFile],
    responses={404: BenefitNotFound},
)
async def files(
    id: BenefitID,
    auth_subject: auth.BenefitsRead,
    pagination: PaginationParamsQuery,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[BenefitDownloadableFile]:
    """List the downloadable files for a benefit with their download statistics."""
    benefit = await benefit_service.get(session, auth_subject, id)

    if benefit is None or benefit.type != BenefitType.downloadables:
        raise ResourceNotFound()

    results, count = await benefit_downloadable_file_service.list(
        session, benefit, pagination=pagination
    )
    return ListResource.from_paginated_results(results, count, pagination)


@router.get(
    "/{id}/grants",
    summary="List Benefit Grants",
    openapi_extra={"x-tool-title": "List Grants for a Benefit"},
    response_model=ListResource[BenefitGrant],
    responses={404: BenefitNotFound},
)
async def grants(
    filters: Annotated[BenefitGrantsParams, Query()],
    id: BenefitID,
    auth_subject: auth.BenefitGrantsRead,
    pagination: PaginationParamsQuery,
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
        is_granted=filters.is_granted,
        customer_id=filters.customer_id,
        member_id=filters.member_id,
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
    Create a benefit, for example license keys, file downloads or Discord access.
    """
    benefit = await benefit_service.user_create(
        session, redis, benefit_create, auth_subject
    )

    return benefit


@router.patch(
    "/{id}",
    summary="Update Benefit",
    openapi_extra=destructive(),
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

    await benefit_service.delete(session, benefit, auth_subject)
