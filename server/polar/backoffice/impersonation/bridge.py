from fastapi import Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import joinedload

from polar.config import settings
from polar.exceptions import BadRequest, NotPermitted, ResourceNotFound
from polar.kit.http import is_localhost
from polar.models import OAuth2Token
from polar.oauth2.service.oauth2_token import oauth2_token as oauth2_token_service
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.redis import Redis, get_redis
from polar.routing import APIRouter

from ..access import RETURN_COOKIE, validate_private_token
from ..auth import BackofficeWebUser, get_backoffice_web_session
from .cookies import get_admin_token, restore_admin_cookies, set_impersonation_cookies
from .handoff import impersonation_handoff as handoff_service
from .service import impersonation as impersonation_service

router = APIRouter(
    prefix="/backoffice/impersonation", tags=["backoffice", APITag.private]
)


@router.get(
    "/start",
    response_class=RedirectResponse,
    status_code=307,
    responses={
        400: {"model": BadRequest.schema()},
        403: {"model": NotPermitted.schema()},
        404: {"model": ResourceNotFound.schema()},
    },
)
async def start(
    request: Request,
    auth_subject: BackofficeWebUser,
    code: str,
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> RedirectResponse:
    if not settings.BACKOFFICE_PRIVATE_URL:
        raise ResourceNotFound()
    handoff = await handoff_service.consume(redis, code)
    if handoff.admin_user_id != auth_subject.subject.id:
        raise NotPermitted("The dashboard and backoffice admins must match")
    token = await oauth2_token_service.get(
        session, handoff.oauth_token_id, options=[joinedload(OAuth2Token.client)]
    )
    if token is None:
        raise NotPermitted("Backoffice authorization has been revoked")
    admin = validate_private_token(token)
    if admin.user_id != auth_subject.subject.id:
        raise NotPermitted("The dashboard and backoffice admins must match")
    admin_session = get_backoffice_web_session(auth_subject)
    admin_token = get_admin_token(request, admin_session)
    (
        token_value,
        impersonation_session,
        organization,
    ) = await impersonation_service.start(
        session,
        admin_session,
        user_id=handoff.user_id,
        organization_id=handoff.organization_id,
        user_agent=request.headers.get("User-Agent", ""),
        current_token=request.cookies.get(settings.USER_SESSION_COOKIE_KEY),
    )
    response = RedirectResponse(
        settings.generate_frontend_url(f"/dashboard/{organization.slug}"), 307
    )
    set_impersonation_cookies(
        response,
        admin_token,
        admin_session,
        token_value,
        impersonation_session,
        secure=not is_localhost(request),
    )
    response.set_cookie(
        RETURN_COOKIE,
        "1",
        max_age=3600,
        domain=settings.USER_SESSION_COOKIE_DOMAIN,
        secure=not is_localhost(request),
        httponly=True,
        samesite="lax",
    )
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


@router.get(
    "/end",
    response_class=RedirectResponse,
    status_code=307,
)
async def end(
    request: Request,
    auth_subject: BackofficeWebUser,
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
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
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response
