from typing import Annotated

from fastapi import Depends, Query
from pydantic import UUID4

from polar.auth.exceptions import SessionNotFreshError
from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import OrganizationAccessToken
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import sorting
from .auth import (
    OrganizationAccessTokensRead,
    OrganizationAccessTokensWrite,
    OrganizationAccessTokensWriteFresh,
)
from .schemas import (
    OrganizationAccessToken as OrganizationAccessTokenSchema,
)
from .schemas import (
    OrganizationAccessTokenCreate,
    OrganizationAccessTokenCreateResponse,
    OrganizationAccessTokenListParams,
    OrganizationAccessTokenUpdate,
)
from .service import organization_access_token as organization_access_token_service

router = APIRouter(
    prefix="/organization-access-tokens",
    tags=["organization_access_tokens", APITag.private],
)


@router.get("/", response_model=ListResource[OrganizationAccessTokenSchema])
async def list(
    filters: Annotated[OrganizationAccessTokenListParams, Query()],
    auth_subject: OrganizationAccessTokensRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[OrganizationAccessTokenSchema]:
    """List organization access tokens."""
    results, count = await organization_access_token_service.list(
        session,
        auth_subject,
        organization_id=filters.organization_id,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [OrganizationAccessTokenSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.post(
    "/",
    response_model=OrganizationAccessTokenCreateResponse,
    status_code=201,
    responses={403: {"model": SessionNotFreshError.schema()}},
)
async def create(
    organization_access_token_create: OrganizationAccessTokenCreate,
    auth_subject: OrganizationAccessTokensWriteFresh,
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


@router.patch(
    "/{id}",
    response_model=OrganizationAccessTokenSchema,
    responses={403: {"model": SessionNotFreshError.schema()}},
)
async def update(
    id: UUID4,
    organization_access_token_update: OrganizationAccessTokenUpdate,
    auth_subject: OrganizationAccessTokensWriteFresh,
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationAccessToken:
    organization_access_token = await organization_access_token_service.get(
        session, auth_subject, id
    )
    if organization_access_token is None:
        raise ResourceNotFound()

    return await organization_access_token_service.update(
        session,
        auth_subject,
        organization_access_token,
        organization_access_token_update,
    )


@router.delete("/{id}", status_code=204)
async def delete(
    id: UUID4,
    auth_subject: OrganizationAccessTokensWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    organization_access_token = await organization_access_token_service.get(
        session, auth_subject, id
    )
    if organization_access_token is None:
        raise ResourceNotFound()

    await organization_access_token_service.delete(
        session, auth_subject, organization_access_token
    )
