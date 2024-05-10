import structlog
from fastapi import APIRouter, Depends

from polar.authz.service import AccessType, Authz
from polar.exceptions import NotPermitted
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

from . import auth
from .schemas import FileCreate, FileRead
from .service import FileService

log = structlog.get_logger()

router = APIRouter(prefix="/files", tags=["files"])


@router.post(
    "/",
    tags=[Tags.PUBLIC],
    response_model=FileRead,
)
async def create_file(
    file: FileCreate,
    auth_subject: auth.CreatorFilesWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> FileRead:
    subject = auth_subject.subject

    organization = await get_payload_organization(session, auth_subject, file)
    if not await authz.can(subject, AccessType.write, organization):
        raise NotPermitted()

    return await FileService.generate_presigned_url(
        session,
        organization=organization,
        create_schema=file,
    )
