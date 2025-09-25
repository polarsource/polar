from fastapi import Depends, Query
from pydantic import UUID4

from polar.auth.dependencies import WebUserRead, WebUserWrite
from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.models import OrganizationAccessToken
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import sorting
from .schemas import (
    OrganizationAccessToken as OrganizationAccessTokenSchema,
)
from .schemas import (
    OrganizationAccessTokenCreate,
    OrganizationAccessTokenCreateResponse,
    OrganizationAccessTokenUpdate,
)
from .service import organization_access_token as organization_access_token_service

router = APIRouter(
    prefix="/organization-access-tokens",
    tags=["organization_access_token", APITag.private],
)


@router.get("/", response_model=ListResource[OrganizationAccessTokenSchema])
async def list(
    auth_subject: WebUserRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[OrganizationAccessTokenSchema]:
    """List organization access tokens."""
    results, count = await organization_access_token_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [OrganizationAccessTokenSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.post("/", response_model=OrganizationAccessTokenCreateResponse, status_code=201)
async def create(
    organization_access_token_create: OrganizationAccessTokenCreate,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationAccessTokenCreateResponse:
    organization_access_token, token = await organization_access_token_service.create(
        session, auth_subject, organization_access_token_create
    )
    return OrganizationAccessTokenCreateResponse.model_validate(
        {
            "organization_access_token": organization_access_token,
            "token": token,
        }
    )


@router.patch("/{id}", response_model=OrganizationAccessTokenSchema)
async def update(
    id: UUID4,
    organization_access_token_update: OrganizationAccessTokenUpdate,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationAccessToken:
    organization_access_token = await organization_access_token_service.get(
        session, auth_subject, id
    )
    if organization_access_token is None:
        raise ResourceNotFound()

    return await organization_access_token_service.update(
        session, organization_access_token, organization_access_token_update
    )


@router.delete("/{id}", status_code=204)
async def delete(
    id: UUID4,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    organization_access_token = await organization_access_token_service.get(
        session, auth_subject, id
    )
    if organization_access_token is None:
        raise ResourceNotFound()

    await organization_access_token_service.delete(session, organization_access_token)
