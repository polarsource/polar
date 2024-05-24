from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, Query
from pydantic import UUID4

from polar.authz.service import AccessType, Authz
from polar.exceptions import NotPermitted, ResourceNotFound
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
    auth_subject: auth.BackerFilesRead,
    pagination: PaginationParamsQuery,
    organization_id: UUID4 | None = Query(
        None,
        description=("Filter by organization behind downloadables. "),
    ),
    file_ids: list[UUID4] | None = Query(
        None,
        description=("Filter by given file IDs. "),
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
        file_ids=file_ids,
    )

    return ListResource.from_paginated_results(
        downloadable_service.generate_downloadable_schemas(results),
        count,
        pagination,
    )


@router.get(
    "/{id}",
    tags=[Tags.PUBLIC],
    response_model=DownloadableRead,
)
async def get(
    id: UUID,
    auth_subject: auth.BackerFilesRead,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> DownloadableRead:
    subject = auth_subject.subject

    downloadable = await downloadable_service.user_get(session, user=subject, id=id)
    if not downloadable:
        raise ResourceNotFound()

    if not await authz.can(subject, AccessType.read, downloadable):
        raise NotPermitted()

    ret = downloadable_service.generate_downloadable_schema(downloadable)
    return ret
