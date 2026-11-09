from fastapi import Depends, Request
from fastapi.exceptions import HTTPException

from polar.auth.service import auth as auth_service
from polar.config import settings
from polar.models import BackofficeUserSession, UserSession
from polar.postgres import AsyncSession, get_db_session

from .auth.service import get_user_session


async def get_admin(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> BackofficeUserSession:
    user_session = await get_user_session(request, session)
    if user_session is not None:
        return user_session

    login_url = settings.generate_backoffice_url("/auth/")
    if request.headers.get("HX-Request") == "true":
        raise HTTPException(status_code=401, headers={"HX-Redirect": login_url})
    if request.method in ("GET", "HEAD"):
        raise HTTPException(status_code=303, headers={"Location": login_url})
    raise HTTPException(status_code=401, detail="Unauthorized")


async def get_legacy_admin(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> UserSession:
    user_session = await auth_service.authenticate(session, request)
    orig_user_session = await auth_service.authenticate(
        session, request, cookie=settings.IMPERSONATION_COOKIE_KEY
    )
    # Original session (admin-user) takes precedence
    user_session = orig_user_session or user_session

    if user_session is None:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user = user_session.user

    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")

    return user_session
