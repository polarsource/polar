from uuid import UUID

import structlog
from fastapi import APIRouter, Depends

from polar.authz.service import AccessType, Authz
from polar.exceptions import NotPermitted
from polar.organization.resolver import get_payload_organization
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

from . import auth
from .schemas import (
    FileCreate,
    FileRead,
    FileUpload,
    FileUploadCompleted,
)
from .service import FileNotFound
from .service import file as file_service

log = structlog.get_logger()

router = APIRouter(prefix="/files", tags=["files"])


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
