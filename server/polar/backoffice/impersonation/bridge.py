from fastapi import Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import joinedload

from polar.config import settings
from polar.exceptions import BadRequest, NotPermitted, ResourceNotFound
from polar.models import OAuth2Token, UserSession
from polar.oauth2.service.oauth2_token import oauth2_token as oauth2_token_service
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.redis import Redis, get_redis
from polar.routing import APIRouter

from ..access import RETURN_COOKIE, validate_private_token
from ..auth import BackofficeWebUser
from .endpoints import end_impersonation, start_impersonation
from .handoff import impersonation_handoff as handoff_service

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
    admin_session = auth_subject.session
    assert isinstance(admin_session, UserSession)
    handoff = await handoff_service.consume(redis, code)
    if handoff.admin_user_id != admin_session.user_id:
        raise NotPermitted("The dashboard and backoffice admins must match")
    token = await oauth2_token_service.get(
        session, handoff.oauth_token_id, options=[joinedload(OAuth2Token.client)]
    )
    if token is None:
        raise NotPermitted("Backoffice authorization has been revoked")
    admin = validate_private_token(token)
    if admin.user_id != admin_session.user_id:
        raise NotPermitted("The dashboard and backoffice admins must match")
    response = await start_impersonation(
        request=request,
        admin_session=admin_session,
        user_id=str(handoff.user_id),
        organization_id=str(handoff.organization_id)
        if handoff.organization_id
        else None,
        session=session,
        redis=redis,
    )
    response.set_cookie(
        RETURN_COOKIE,
        "1",
        max_age=3600,
        domain=settings.USER_SESSION_COOKIE_DOMAIN,
        secure=request.url.hostname not in {"127.0.0.1", "localhost"},
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
    response = await end_impersonation(request=request, session=session)
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response
