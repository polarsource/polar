import structlog
from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse
from pydantic import UUID4

from polar.authz.service import Authz
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

from . import auth
from .schemas import (
    DownloadableRead,
)
from .service import downloadable as downloadable_service

log = structlog.get_logger()

router = APIRouter(prefix="/downloadables", tags=["downloadables"])


@router.get(
    "",
    tags=[Tags.PUBLIC],
    response_model=ListResource[DownloadableRead],
)
async def list(
    auth_subject: auth.UserDownloadablesRead,
    pagination: PaginationParamsQuery,
    organization_id: UUID4 | None = Query(
        None,
        description=("Filter by organization behind downloadables. "),
    ),
    benefit_id: UUID4 | None = Query(
        None,
        description=("Filter by given benefit ID. "),
    ),
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[DownloadableRead]:
    subject = auth_subject.subject

    results, count = await downloadable_service.get_list(
        session,
        user=subject,
        pagination=pagination,
        organization_id=organization_id,
        benefit_id=benefit_id,
    )

    return ListResource.from_paginated_results(
        downloadable_service.generate_downloadable_schemas(results),
        count,
        pagination,
    )


@router.get(
    "/{token}",
    tags=[Tags.PUBLIC],
    responses={
        302: {"description": "Redirected to download"},
        400: {"description": "Invalid signature"},
        404: {"description": "Downloadable not found"},
        410: {"description": "Expired signature"},
    },
)
async def get(
    token: str,
    auth_subject: auth.UserDownloadablesRead,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    subject = auth_subject.subject

    downloadable = await downloadable_service.get_from_token_or_raise(
        session, user=subject, token=token
    )
    signed = downloadable_service.generate_download_schema(downloadable)
    return RedirectResponse(signed.file.download.url, 302)
