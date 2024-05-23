import structlog
from fastapi import APIRouter, Depends
from pydantic import UUID4

from polar.authz.service import AccessType, Authz
from polar.benefit.benefits.downloadables.files import BenefitDownloadablesFiles
from polar.exceptions import NotPermitted
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
    "/{file_id}/uploaded",
    tags=[Tags.PUBLIC],
    response_model=FileRead,
)
async def uploaded(
    file_id: UUID4,
    completed_schema: FileUploadCompleted,
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

    return await file_service.complete_upload(
        session, file=file, completed_schema=completed_schema
    )


@router.patch(
    "/files/{file_id}",
    tags=[Tags.PUBLIC],
    response_model=FileRead,
)
async def update(
    auth_subject: auth.CreatorFilesWrite,
    file_id: UUID4,
    patches: FilePatch,
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

    updated = await file_service.patch(session, file=file, patches=patches)
    return FileRead.from_db(updated)


@router.get(
    "/downloadables/{benefit_id}",
    tags=[Tags.PUBLIC],
    response_model=list[FileRead],
)
async def list_downloadables(
    auth_subject: auth.CreatorFilesWrite,
    benefit_id: UUID4,
    organization_id: UUID4 | None = None,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> list[FileRead]:
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

    benefit_files = BenefitDownloadablesFiles(session, benefit_id)
    # Ensure accessed benefit belongs to organization admin
    await benefit_files.ensure_organization_matches(organization.id)

    file_ids = await benefit_files.get_file_ids()
    if not file_ids:
        return []

    files = await file_service.get_by_ids(
        session, organization_id=organization.id, ids=file_ids
    )
    mapping = {file.id: FileRead.from_db(file) for file in files}
    return await benefit_files.sort_mapping(mapping)
