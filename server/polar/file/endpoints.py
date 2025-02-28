from collections.abc import Sequence
from typing import Annotated

from fastapi import Depends, Path, Query
from pydantic import UUID4

from polar.authz.service import AccessType, Authz
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import File, Organization
from polar.openapi import APITag
from polar.organization.resolver import get_payload_organization
from polar.organization.schemas import OrganizationID
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import auth
from .schemas import (
    FileCreate,
    FilePatch,
    FileRead,
    FileReadAdapter,
    FileUpload,
    FileUploadCompleted,
)
from .service import file as file_service

router = APIRouter(prefix="/files", tags=["files", APITag.documented])

FileID = Annotated[UUID4, Path(description="The file ID.")]
FileNotFound = {"description": "File not found.", "model": ResourceNotFound.schema()}


@router.get("/", summary="List Files", response_model=ListResource[FileRead])
async def list(
    auth_subject: auth.FileRead,
    pagination: PaginationParamsQuery,
    organization_id: OrganizationID | None = None,
    ids: Sequence[UUID4] | None = Query(
        None,
        description=("List of file IDs to get. "),
    ),
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[FileRead]:
    """List files."""
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
        [FileReadAdapter.validate_python(result) for result in results],
        count,
        pagination,
    )


@router.post(
    "/",
    response_model=FileUpload,
    summary="Create File",
    status_code=201,
    responses={201: {"description": "File created."}},
)
async def create(
    file_create: FileCreate,
    auth_subject: auth.FileWrite,
    session: AsyncSession = Depends(get_db_session),
) -> FileUpload:
    """Create a file."""
    organization = await get_payload_organization(session, auth_subject, file_create)

    file_create.organization_id = organization.id
    return await file_service.generate_presigned_upload(
        session,
        organization=organization,
        create_schema=file_create,
    )


@router.post(
    "/{id}/uploaded",
    summary="Complete File Upload",
    response_model=FileRead,
    responses={
        200: {"description": "File upload completed."},
        403: {
            "description": "You don't have the permission to update this file.",
            "model": NotPermitted.schema(),
        },
        404: FileNotFound,
    },
)
async def uploaded(
    id: FileID,
    completed_schema: FileUploadCompleted,
    auth_subject: auth.FileWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> File:
    """Complete a file upload."""
    subject = auth_subject.subject

    file = await file_service.get(session, id)
    if not file:
        raise ResourceNotFound()

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
    summary="Update File",
    response_model=FileRead,
    responses={
        200: {"description": "File updated."},
        403: {
            "description": "You don't have the permission to update this file.",
            "model": NotPermitted.schema(),
        },
        404: FileNotFound,
    },
)
async def update(
    auth_subject: auth.FileWrite,
    id: FileID,
    patches: FilePatch,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> File:
    """Update a file."""
    subject = auth_subject.subject

    file = await file_service.get(session, id)
    if not file:
        raise ResourceNotFound()

    organization = await organization_service.get(session, file.organization_id)
    if not organization:
        raise NotPermitted()

    if not await authz.can(subject, AccessType.write, organization):
        raise NotPermitted()

    return await file_service.patch(session, file=file, patches=patches)


@router.delete(
    "/{id}",
    summary="Delete File",
    status_code=204,
    responses={
        204: {"description": "File deleted."},
        403: {
            "description": "You don't have the permission to delete this file.",
            "model": NotPermitted.schema(),
        },
        404: FileNotFound,
    },
)
async def delete(
    auth_subject: auth.FileWrite,
    id: UUID4,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a file."""
    subject = auth_subject.subject

    file = await file_service.get(session, id)
    if not file:
        raise ResourceNotFound()

    organization = await organization_service.get(session, file.organization_id)
    if not organization:
        raise NotPermitted()

    if not await authz.can(subject, AccessType.write, organization):
        raise NotPermitted()

    await file_service.delete(session, file=file)
