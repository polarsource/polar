from uuid import UUID

import structlog
from fastapi import APIRouter, Depends

from polar.authz.service import AccessType, Authz
from polar.exceptions import NotPermitted
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

from . import auth
from .schemas import FileCreate, FilePresignedRead, FileRead
from .service import FileNotFound
from .service import file as file_service
from .service import file_permission as file_permission_service

log = structlog.get_logger()

router = APIRouter(prefix="/files", tags=["files"])


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
    if not (permission or await authz.can(subject, AccessType.read, permission)):
        raise NotPermitted()

    ret = await file_service.generate_presigned_download_url(
        session,
        user=subject,
        file=file,
    )
    # TODO: Update download request count
    return ret


@router.post(
    "/",
    tags=[Tags.PUBLIC],
    response_model=FilePresignedRead,
)
async def create_file(
    file: FileCreate,
    auth_subject: auth.CreatorFilesWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> FilePresignedRead:
    subject = auth_subject.subject

    organization = await get_payload_organization(session, auth_subject, file)
    if not await authz.can(subject, AccessType.write, organization):
        raise NotPermitted()

    return await file_service.generate_presigned_upload_url(
        session,
        organization=organization,
        create_schema=file,
    )


@router.post(
    "/{file_id}/uploaded",
    tags=[Tags.PUBLIC],
    response_model=FileRead,
)
async def mark_uploaded(
    file_id: UUID,
    auth_subject: auth.CreatorFilesWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> FileRead:
    subject = auth_subject.subject

    file = await file_service.get(session, file_id)
    if not file:
        raise FileNotFound(f"No file exists with ID: {file_id}")

    organization = await get_payload_organization(session, auth_subject, file)
    if not await authz.can(subject, AccessType.write, organization):
        raise NotPermitted()

    return await file_service.mark_uploaded(
        session,
        organization=organization,
        file=file,
    )
