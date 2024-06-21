from uuid import UUID

from fastapi import Depends
from fastapi.responses import RedirectResponse

from polar.config import settings
from polar.openapi import IN_DEVELOPMENT_ONLY
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .service import AuthService

router = APIRouter(tags=["auth"], include_in_schema=IN_DEVELOPMENT_ONLY)


@router.get(
    "/auth/logout",
)
async def logout(
    organization_id: UUID | None = None,
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    redirect_to = settings.FRONTEND_BASE_URL

    response = RedirectResponse(redirect_to)
    AuthService.set_auth_cookie(response=response, value="", expires=0)
    return response
