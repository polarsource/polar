import structlog
from fastapi import APIRouter, Depends

from polar.authz.service import Authz
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

from .schemas import FileCreate, FileCreateSignedURL
from .service import FileService

log = structlog.get_logger()

router = APIRouter(prefix="/files", tags=["files"])


@router.post(
    "/",
    tags=[Tags.PUBLIC],
    response_model=FileCreateSignedURL,
)
async def create_file(
    file: FileCreate,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> FileCreateSignedURL:
    return FileService.generate_presigned_url(file)
