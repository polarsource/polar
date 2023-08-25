from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException

from polar.auth.dependencies import Auth
from polar.auth.service import AuthService
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags
from polar.types import ListResource, Pagination

from .schemas import (
    CreatePersonalAccessToken,
    CreatePersonalAccessTokenResponse,
    PersonalAccessToken,
)
from .service import personal_access_token_service

log = structlog.get_logger()

router = APIRouter(tags=["personal_access_token"])


@router.delete(
    "/personal_access_tokens/{id}",
    response_model=PersonalAccessToken,
    tags=[Tags.PUBLIC],
    description="Delete a personal access tokens. Requires authentication.",  # noqa: E501
    summary="Delete a personal access tokens (Public API)",
    status_code=200,
)
async def delete(
    id: UUID,
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PersonalAccessToken:
    if not auth.user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    pat = await personal_access_token_service.get(session, id)
    if not pat:
        raise HTTPException(status_code=404, detail="PAT not found")

    if pat.user_id != auth.user.id:
        raise HTTPException(status_code=403, detail="PAT not owned by this user")

    await personal_access_token_service.delete(session, id)

    return PersonalAccessToken.from_db(pat)


@router.get(
    "/personal_access_tokens",
    response_model=ListResource[PersonalAccessToken],
    tags=[Tags.PUBLIC],
    description="List personal access tokens. Requires authentication.",  # noqa: E501
    summary="List personal access tokens (Public API)",
    status_code=200,
)
async def list(
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[PersonalAccessToken]:
    if not auth.user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    pats = await personal_access_token_service.list_for_user(session, auth.user.id)

    return ListResource(
        items=[PersonalAccessToken.from_db(p) for p in pats],
        pagination=Pagination(total_count=len(pats)),
    )


@router.post(
    "/personal_access_tokens",
    response_model=CreatePersonalAccessTokenResponse,
    tags=[Tags.PUBLIC],
    description="Create a new personal access token. Requires authentication.",  # noqa: E501
    summary="Create a new personal access token (Public API)",
    status_code=200,
)
async def create(
    payload: CreatePersonalAccessToken,
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
) -> CreatePersonalAccessTokenResponse:
    if not auth.user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    pat = await personal_access_token_service.create(
        session, user_id=auth.user.id, comment=payload.comment
    )

    return CreatePersonalAccessTokenResponse(
        id=pat.id,
        created_at=pat.created_at,
        last_used_at=pat.last_used_at,
        comment=pat.comment,
        expires_at=pat.expires_at,
        token=AuthService.generate_pat_token(pat.id, pat.expires_at),
    )
