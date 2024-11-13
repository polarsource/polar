from fastapi.responses import RedirectResponse

from polar.config import settings
from polar.openapi import APITag
from polar.routing import APIRouter

from .service import AuthService

router = APIRouter(tags=["auth", APITag.private])


@router.get("/auth/logout")
async def logout() -> RedirectResponse:
    response = RedirectResponse(settings.FRONTEND_BASE_URL)
    AuthService.set_auth_cookie(response=response, value="", expires=0)
    return response
