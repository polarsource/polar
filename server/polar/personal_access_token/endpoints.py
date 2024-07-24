from fastapi import Depends
from pydantic import UUID4

from polar.auth.dependencies import WebUser
from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.openapi import IN_DEVELOPMENT_ONLY
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .schemas import (
    PersonalAccessToken,
    PersonalAccessTokenCreate,
    PersonalAccessTokenCreateResponse,
)
from .service import personal_access_token as personal_access_token_service

router = APIRouter(
    prefix="/personal_access_tokens",
    tags=["personal_access_token"],
    include_in_schema=IN_DEVELOPMENT_ONLY,
)


@router.get("/", response_model=ListResource[PersonalAccessToken])
async def list_personal_access_tokens(
    auth_subject: WebUser,
    pagination: PaginationParamsQuery,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[PersonalAccessToken]:
    """List personal access tokens."""
    results, count = await personal_access_token_service.list(
        session, auth_subject, pagination=pagination
    )

    return ListResource.from_paginated_results(
        [PersonalAccessToken.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.post("/", response_model=PersonalAccessTokenCreateResponse, status_code=201)
async def create_personal_access_token(
    personal_access_token_create: PersonalAccessTokenCreate,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
) -> PersonalAccessTokenCreateResponse:
    personal_access_token, token = await personal_access_token_service.create(
        session, auth_subject, personal_access_token_create
    )
    return PersonalAccessTokenCreateResponse.model_validate(
        {
            "personal_access_token": personal_access_token,
            "token": token,
        }
    )


@router.delete("/{id}", status_code=204)
async def delete_personal_access_token(
    id: UUID4,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    personal_access_token = await personal_access_token_service.get_by_id(
        session, auth_subject, id
    )
    if personal_access_token is None:
        raise ResourceNotFound()

    await personal_access_token_service.delete(session, personal_access_token)
