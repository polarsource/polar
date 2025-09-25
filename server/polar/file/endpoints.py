from typing import Annotated

from fastapi import Depends, Path, Query
from pydantic import UUID4

from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.models import File
from polar.openapi import APITag
from polar.organization.resolver import get_payload_organization
from polar.organization.schemas import OrganizationID
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
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

router = APIRouter(prefix="/files", tags=["files", APITag.public])

FileID = Annotated[UUID4, Path(description="The file ID.")]
FileNotFound = {"description": "File not found.", "model": ResourceNotFound.schema()}


@router.get("/", summary="List Files", response_model=ListResource[FileRead])
async def list(
    auth_subject: auth.FileRead,
    pagination: PaginationParamsQuery,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    ids: MultipleQueryFilter[UUID4] | None = Query(
        None, title="FileID Filter", description="Filter by file ID."
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[FileRead]:
    """List files."""
    results, count = await file_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        ids=ids,
        pagination=pagination,
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
    session: AsyncSession = Depends(get_db_session),
) -> File:
    """Complete a file upload."""
    file = await file_service.get(session, auth_subject, id)
    if file is None:
        raise ResourceNotFound()

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
    session: AsyncSession = Depends(get_db_session),
) -> File:
    """Update a file."""
    file = await file_service.get(session, auth_subject, id)
    if file is None:
        raise ResourceNotFound()

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
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a file."""
    file = await file_service.get(session, auth_subject, id)
    if file is None:
        raise ResourceNotFound()

    await file_service.delete(session, file=file)
