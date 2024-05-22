from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, Query
from pydantic import UUID4

from polar.authz.service import AccessType, Authz
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import User
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

from . import auth
from .schemas import (
    DownloadableRead,
)
from .service import downloadable as downloadable_service

log = structlog.get_logger()

router = APIRouter(prefix="/downloadables", tags=["downloadables"])


async def get_list(
    session: AsyncSession,
    *,
    pagination: PaginationParamsQuery,
    user: User,
    organization_id: UUID4 | None = None,
) -> ListResource[DownloadableRead]:
    results, count = await downloadable_service.get_accessible_for_user(
        session,
        user=user,
        organization_id=organization_id,
        pagination=pagination,
    )

    if not results:
        return ListResource.from_paginated_results([], 0, pagination)

    return ListResource.from_paginated_results(
        downloadable_service.generate_downloadable_schemas(results),
        count,
        pagination,
    )


async def get_benefit_list(
    session: AsyncSession,
    *,
    pagination: PaginationParamsQuery,
    user: User,
    benefit_id: UUID4,
    organization_id: UUID4 | None = None,
) -> ListResource[DownloadableRead]:
    results, count = await downloadable_service.get_accessible_for_user_by_benefit_id(
        session,
        user=user,
        pagination=pagination,
        benefit_id=benefit_id,
        organization_id=organization_id,
    )

    if not results:
        return ListResource.from_paginated_results([], 0, pagination)

    return ListResource.from_paginated_results(
        downloadable_service.generate_downloadable_schemas(results),
        count,
        pagination,
    )


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
        description=("Filter by organization files belong to. "),
    ),
    benefit_id: UUID4 | None = Query(
        None,
        description=("Filter by granted benefit. "),
    ),
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[DownloadableRead]:
    subject = auth_subject.subject

    if not benefit_id:
        # Sorted by when file was granted
        return await get_list(
            session,
            pagination=pagination,
            user=subject,
            organization_id=organization_id,
        )

    # Sorted by benefit specific order
    return await get_benefit_list(
        session,
        pagination=pagination,
        user=subject,
        benefit_id=benefit_id,
        organization_id=organization_id,
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

    downloadable = await downloadable_service.get_accessible_for_user_by_id(
        session, user=subject, id=id
    )
    if not downloadable:
        raise ResourceNotFound()

    if not await authz.can(subject, AccessType.read, downloadable):
        raise NotPermitted()

    ret = downloadable_service.generate_downloadable_schema(downloadable)
    return ret
