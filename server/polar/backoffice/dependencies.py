from fastapi import Depends, Request
from fastapi.exceptions import HTTPException

from polar.audit.context import AuditContext
from polar.audit.enums import AuditActorType
from polar.auth.service import auth as auth_service
from polar.config import settings
from polar.models.user_session import UserSession
from polar.postgres import AsyncSession, get_db_session


async def get_admin(
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

    # Set audit context for backoffice requests (separate ASGI app,
    # so AuthSubjectMiddleware doesn't run here)
    ip_address = request.client.host if request.client else None
    AuditContext.set(
        actor_type=AuditActorType.admin,
        actor_id=user.id,
        actor_name=user.email,
        ip_address=ip_address,
    )

    return user_session
