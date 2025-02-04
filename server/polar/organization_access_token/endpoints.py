from fastapi import Depends
from pydantic import UUID4

from polar.auth.dependencies import WebUser
from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .schemas import (
    OrganizationAccessToken,
    OrganizationAccessTokenCreate,
    OrganizationAccessTokenCreateResponse,
)
from .service import organization_access_token as organization_access_token_service

router = APIRouter(
    prefix="/organization-access-tokens",
    tags=["organization_access_token", APITag.private],
)


@router.get("/", response_model=ListResource[OrganizationAccessToken])
async def list(
    auth_subject: WebUser,
    pagination: PaginationParamsQuery,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[OrganizationAccessToken]:
    """List organization access tokens."""
    results, count = await organization_access_token_service.list(
        session, auth_subject, pagination=pagination
    )

    return ListResource.from_paginated_results(
        [OrganizationAccessToken.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.post("/", response_model=OrganizationAccessTokenCreateResponse, status_code=201)
async def create(
    organization_access_token_create: OrganizationAccessTokenCreate,
    auth_subject: WebUser,
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


@router.delete("/{id}", status_code=204)
async def delete(
    id: UUID4,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    organization_access_token = await organization_access_token_service.get(
        session, auth_subject, id
    )
    if organization_access_token is None:
        raise ResourceNotFound()

    await organization_access_token_service.delete(session, organization_access_token)
