from uuid import UUID

from fastapi import Depends, Form, Request
from fastapi.responses import RedirectResponse

from polar.backoffice.routing import BackofficeRouter
from polar.config import settings
from polar.exceptions import BadRequest
from polar.kit.http import is_localhost
from polar.postgres import AsyncSession, get_db_session
from polar.redis import Redis, get_redis

from ..access import (
    RETURN_COOKIE,
    AdminSession,
    OAuthAdminSession,
    is_private_backoffice,
)
from ..dependencies import get_admin
from ..responses import HXRedirectResponse
from .cookies import get_admin_token, restore_admin_cookies, set_impersonation_cookies
from .handoff import ImpersonationHandoff
from .handoff import impersonation_handoff as handoff_service
from .service import impersonation as impersonation_service

router = BackofficeRouter()


@router.post("/start", name="backoffice:start_impersonation")
async def start_impersonation(
    request: Request,
    admin_session: AdminSession = Depends(get_admin),
    user_id: UUID = Form(),
    organization_id: UUID | None = Form(default=None),
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> RedirectResponse:
    if isinstance(admin_session, OAuthAdminSession):
        code = await handoff_service.create(
            redis,
            ImpersonationHandoff(
                oauth_token_id=admin_session.oauth_token.id,
                admin_user_id=admin_session.user_id,
                user_id=user_id,
                organization_id=organization_id,
            ),
        )
        return HXRedirectResponse(
            request,
            settings.generate_external_url(
                f"/v1/backoffice/impersonation/start?code={code}"
            ),
            303,
        )

    admin_token = get_admin_token(request, admin_session)
    token, impersonation_session, organization = await impersonation_service.start(
        session,
        admin_session,
        user_id=user_id,
        organization_id=organization_id,
        user_agent=request.headers.get("User-Agent", ""),
        current_token=request.cookies.get(settings.USER_SESSION_COOKIE_KEY),
    )
    response = HXRedirectResponse(
        request, settings.generate_frontend_url(f"/dashboard/{organization.slug}"), 307
    )
    response.delete_cookie(RETURN_COOKIE, domain=settings.USER_SESSION_COOKIE_DOMAIN)
    set_impersonation_cookies(
        response,
        admin_token,
        admin_session,
        token,
        impersonation_session,
        secure=not is_localhost(request),
    )
    return response


@router.get("/end", name="backoffice:end_impersonation")
async def end_impersonation(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    if is_private_backoffice(request):
        return RedirectResponse(
            settings.generate_external_url("/v1/backoffice/impersonation/end"), 303
        )
    admin_token = request.cookies.get(settings.IMPERSONATION_COOKIE_KEY)
    if not admin_token:
        raise BadRequest("No admin session found")
    admin_session, organization_id = await impersonation_service.end(
        session,
        admin_token=admin_token,
        current_token=request.cookies.get(settings.USER_SESSION_COOKIE_KEY),
    )
    return_path = f"/organizations/{organization_id}" if organization_id else "/"
    return_url = (
        f"{settings.BACKOFFICE_PRIVATE_URL}{return_path}"
        if request.cookies.get(RETURN_COOKIE) == "1" and settings.BACKOFFICE_PRIVATE_URL
        else settings.generate_backoffice_url(return_path)
    )
    response = RedirectResponse(return_url)
    restore_admin_cookies(
        response, admin_token, admin_session, secure=not is_localhost(request)
    )
    return response
