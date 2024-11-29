from fastapi import Depends, Request
from fastapi.responses import RedirectResponse

from polar.models import UserSession as UserSession
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .dependencies import get_user_session
from .service import auth as auth_service

router = APIRouter(tags=["auth", APITag.private])


@router.get("/auth/logout")
async def logout(
    request: Request,
    user_session: UserSession | None = Depends(get_user_session),
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    return await auth_service.get_logout_response(session, request, user_session)
