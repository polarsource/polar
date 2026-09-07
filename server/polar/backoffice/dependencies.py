from fastapi import Depends, Request
from fastapi.exceptions import HTTPException

from polar.auth.service import auth as auth_service
from polar.config import settings
from polar.postgres import AsyncSession, get_db_session

from .access import (
    AdminSession,
    get_private_session,
    is_private_backoffice,
    require_tailscale_user,
)


async def get_admin(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> AdminSession:
    user_session: AdminSession | None
    if is_private_backoffice(request):
        user_session = await get_private_session(request, session)
    else:
        user_session = await auth_service.authenticate(session, request)
        orig_user_session = await auth_service.authenticate(
            session, request, cookie=settings.IMPERSONATION_COOKIE_KEY
        )
        # Original session (admin-user) takes precedence
        user_session = orig_user_session or user_session

    if user_session is None:
        if is_private_backoffice(request) and request.method in {"GET", "HEAD"}:
            raise HTTPException(303, headers={"Location": "/auth/login"})
        raise HTTPException(status_code=401, detail="Unauthorized")

    user = user_session.user

    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")

    if is_private_backoffice(request):
        require_tailscale_user(request, user_session)

    return user_session
