from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Path, Query
from pydantic import UUID4

from polar.authz.service import AccessType, Authz
from polar.exceptions import NotPermitted
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import Organization
from polar.organization.resolver import get_payload_organization
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

from . import auth
from .schemas import (
    FileCreate,
    FilePatch,
    FileRead,
    FileUpload,
    FileUploadCompleted,
)
from .service import FileNotFound
from .service import file as file_service

log = structlog.get_logger()

router = APIRouter(prefix="/files", tags=["files"])

FileID = Annotated[UUID4, Path(description="The file ID.")]
FileNotFoundResponse = {
    "description": "File not found.",
    "model": FileNotFound.schema(),
}


@router.get(
    "",
    tags=[Tags.PUBLIC],
    response_model=ListResource[FileRead],
)
async def list(
    auth_subject: auth.CreatorFilesWrite,
    pagination: PaginationParamsQuery,
    organization_id: UUID4 | None = None,
    ids: list[UUID4] | None = Query(
        None,
        description=("List of file IDs to get. "),
    ),
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[FileRead]:
    subject = auth_subject.subject

    if not organization_id:
        if not isinstance(subject, Organization):
            raise NotPermitted()
        organization_id = subject.id

    organization = await organization_service.get(session, organization_id)
    if not organization:
        raise NotPermitted()

    if not await authz.can(subject, AccessType.write, organization):
        raise NotPermitted()

    results, count = await file_service.get_list(
        session, organization_id=organization_id, ids=ids, pagination=pagination
    )
    return ListResource.from_paginated_results(
        [FileRead.from_db(result) for result in results],
        count,
        pagination,
    )


@router.post(
    "/",
    tags=[Tags.PUBLIC],
    response_model=FileUpload,
)
async def create(
    file: FileCreate,
    auth_subject: auth.CreatorFilesWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> FileUpload:
    subject = auth_subject.subject

    organization = await get_payload_organization(session, auth_subject, file)
    if not await authz.can(subject, AccessType.write, organization):
        raise NotPermitted()

    file.organization_id = organization.id
    return await file_service.generate_presigned_upload(
        session,
        organization=organization,
        create_schema=file,
    )


@router.post(
    "/{id}/uploaded",
    tags=[Tags.PUBLIC],
    response_model=FileRead,
)
async def uploaded(
    id: FileID,
    completed_schema: FileUploadCompleted,
    auth_subject: auth.CreatorFilesWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> FileRead:
    subject = auth_subject.subject

    file = await file_service.get(session, id)
    if not file:
        raise FileNotFound(f"No file exists with ID: {id}")

    organization = await organization_service.get(session, file.organization_id)
    if not organization:
        raise NotPermitted()

    if not await authz.can(subject, AccessType.write, organization):
        raise NotPermitted()

    return await file_service.complete_upload(
        session, file=file, completed_schema=completed_schema
    )


# Re-introduce with changing version
@router.patch(
    "/{id}",
    tags=[Tags.PUBLIC],
    response_model=FileRead,
)
async def update(
    auth_subject: auth.CreatorFilesWrite,
    id: FileID,
    patches: FilePatch,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> FileRead:
    subject = auth_subject.subject

    file = await file_service.get(session, id)
    if not file:
        raise FileNotFound(f"No file exists with ID: {id}")

    organization = await organization_service.get(session, file.organization_id)
    if not organization:
        raise NotPermitted()

    if not await authz.can(subject, AccessType.write, organization):
        raise NotPermitted()

    updated = await file_service.patch(session, file=file, patches=patches)
    return FileRead.from_db(updated)


@router.delete(
    "/{id}",
    status_code=204,
    tags=[Tags.PUBLIC],
    responses={
        204: {"description": "File deleted."},
        403: {
            "description": (
                "You don't have the permission to update this file "
                "or it's not deletable."
            ),
            "model": NotPermitted.schema(),
        },
        404: FileNotFoundResponse,
    },
)
async def delete(
    auth_subject: auth.CreatorFilesWrite,
    id: UUID4,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    subject = auth_subject.subject

    file = await file_service.get(session, id)
    if not file:
        raise FileNotFound(f"No file exists with ID: {id}")

    organization = await organization_service.get(session, file.organization_id)
    if not organization:
        raise NotPermitted()

    if not await authz.can(subject, AccessType.write, organization):
        raise NotPermitted()

    await file_service.delete(session, file=file)
