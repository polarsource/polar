from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, Query
from pydantic import UUID4

from polar.authz.service import AccessType, Authz
from polar.exceptions import NotPermitted
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.organization.resolver import get_payload_organization
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

from . import auth
from .schemas import (
    FileCreate,
    FilePresignedRead,
    FileRead,
    FileSubscriberRead,
    FileUpload,
    FileUploadCompleted,
)
from .service import FileNotFound
from .service import file as file_service
from .service import file_permission as file_permission_service

log = structlog.get_logger()

router = APIRouter(prefix="/files", tags=["files"])


@router.get(
    "",
    tags=[Tags.PUBLIC],
    response_model=ListResource[FileSubscriberRead],
)
async def get_user_accessible_files(
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
) -> ListResource[FileSubscriberRead]:
    subject = auth_subject.subject

    results, count = await file_permission_service.get_user_accessible_files(
        session,
        user=subject,
        organization_id=organization_id,
        benefit_id=benefit_id,
        pagination=pagination,
    )
    if not results:
        return ListResource.from_paginated_results([], 0, pagination)

    items = []
    for file in results:
        url, expires_at = await file_service.generate_presigned_download(file)
        item = FileSubscriberRead.from_presign(file, url=url, expires_at=expires_at)
        items.append(item)

    return ListResource.from_paginated_results(
        items,
        count,
        pagination,
    )


@router.get(
    "/{file_id}",
    tags=[Tags.PUBLIC],
    response_model=FilePresignedRead,
)
async def get_file(
    file_id: UUID,
    auth_subject: auth.BackerFilesRead,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> FilePresignedRead:
    subject = auth_subject.subject

    file = await file_service.get(session, file_id)
    if not file:
        raise FileNotFound()

    permission = await file_permission_service.get_permission(
        session, user=subject, file=file
    )
    if not permission:
        raise NotPermitted()

    if not await authz.can(subject, AccessType.read, permission):
        raise NotPermitted()

    url, expires_at = await file_service.generate_presigned_download(file)
    await file_permission_service.increment_download_count(session, permission)
    return FilePresignedRead.from_presign(
        file,
        url=url,
        expires_at=expires_at,
    )


@router.post(
    "/",
    tags=[Tags.PUBLIC],
    response_model=FileUpload,
)
async def create_file(
    file: FileCreate,
    auth_subject: auth.CreatorFilesWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> FileUpload:
    subject = auth_subject.subject

    organization = await get_payload_organization(session, auth_subject, file)
    if not await authz.can(subject, AccessType.write, organization):
        raise NotPermitted()

    return await file_service.generate_presigned_upload(
        session,
        organization=organization,
        create_schema=file,
    )


@router.patch(
    "/{file_id}",
    tags=[Tags.PUBLIC],
    response_model=FileRead,
)
async def complete_upload(
    file_id: UUID,
    payload: FileUploadCompleted,
    auth_subject: auth.CreatorFilesWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> FileRead:
    subject = auth_subject.subject

    file = await file_service.get(session, file_id)
    if not file:
        raise FileNotFound(f"No file exists with ID: {file_id}")

    organization = await organization_service.get(session, file.organization_id)
    if not organization:
        raise NotPermitted()

    if not await authz.can(subject, AccessType.write, organization):
        raise NotPermitted()

    file = await file_service.complete_upload(
        session,
        file=file,
        payload=payload,
    )
    return FileRead.from_db(file)
