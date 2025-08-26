from fastapi import Depends, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from polar.models import UserSession as UserSession
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .service import auth as auth_service

router = APIRouter(tags=["auth", APITag.private])


class ImpersonateResponse(BaseModel):
    success: bool
    message: str


@router.get("/auth/logout")
async def logout(
    request: Request, session: AsyncSession = Depends(get_db_session)
) -> RedirectResponse:
    user_session = await auth_service.authenticate(session, request)
    return await auth_service.get_logout_response(session, request, user_session)
