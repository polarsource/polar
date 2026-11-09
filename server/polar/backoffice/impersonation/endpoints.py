from datetime import timedelta
from typing import Any

from fastapi import (
    Depends,
    Form,
    HTTPException,
    Request,
    Response,
    status,
)
from fastapi.responses import RedirectResponse
from sqlalchemy import select

from polar.auth.scope import READ_ONLY_SCOPES
from polar.auth.service import auth as auth_service
from polar.backoffice.routing import BackofficeRouter
from polar.config import settings
from polar.kit.http import is_localhost
from polar.models import (
    User,
)
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession, get_db_session

from ..responses import HXRedirectResponse

router = BackofficeRouter()


@router.post(
    "/start",
    name="backoffice:start_impersonation",
)
async def start_impersonation(
    request: Request,
    user_id: str = Form(),
    organization_id: str | None = Form(default=None),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Start a read-only dashboard session scoped to the target organization."""

    # Get the target user
    result = await session.execute(select(User).where(User.id == user_id))
    target_user = result.unique().scalar_one_or_none()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    org_repository = OrganizationRepository.from_session(session)
    user_orgs = await org_repository.get_all_by_user(target_user.id)
    target_org = next(
        (org for org in user_orgs if str(org.id) == organization_id),
        user_orgs[0] if user_orgs else None,
    )
    if target_org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User has no organizations to impersonate into",
        )

    # Scope the session to the organization so it can reach the org even when SSO
    # is enforced (and can eventually break the glass if something is misconfigured).
    token, impersonation_session = await auth_service._create_user_session(
        session=session,
        user=target_user,
        user_agent=request.headers.get("User-Agent", ""),
        scopes=list(READ_ONLY_SCOPES),
        expire_in=timedelta(minutes=60),
        organization_ids=frozenset({target_org.id}),
    )

    dashboard_session = await auth_service.authenticate(session, request)
    original_cookie = settings.USER_SESSION_COOKIE_KEY
    if dashboard_session is None:
        original_cookie = settings.IMPERSONATION_COOKIE_KEY
        dashboard_session = await auth_service.authenticate(
            session, request, cookie=original_cookie
        )

    response = HXRedirectResponse(
        request, f"{settings.FRONTEND_BASE_URL}/dashboard/{target_org.slug}", 303
    )
    if dashboard_session is not None:
        response.set_cookie(
            settings.IMPERSONATION_COOKIE_KEY,
            value=request.cookies[original_cookie],
            expires=dashboard_session.expires_at,
            httponly=True,
            secure=not is_localhost(request),
            samesite="lax",
        )
    else:
        response.delete_cookie(settings.IMPERSONATION_COOKIE_KEY)

    auth_service._set_user_session_cookie(
        request, response, token, impersonation_session.expires_at
    )

    # Set JS-readable impersonation indicator cookie
    response.set_cookie(
        settings.IMPERSONATION_INDICATOR_COOKIE_KEY,
        value="true",
        expires=impersonation_session.expires_at,
        path="/",
        domain=settings.USER_SESSION_COOKIE_DOMAIN,
        secure=not is_localhost(request),
        httponly=False,  # JS-readable
        samesite="lax",
    )

    return response


@router.get("/end", name="backoffice:end_impersonation")
async def end_impersonation(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """End impersonation and restore the saved dashboard session."""
    original_session = await auth_service.authenticate(
        session, request, cookie=settings.IMPERSONATION_COOKIE_KEY
    )
    response = RedirectResponse(settings.generate_backoffice_url("/"))
    if original_session is not None:
        auth_service._set_user_session_cookie(
            request,
            response,
            request.cookies[settings.IMPERSONATION_COOKIE_KEY],
            original_session.expires_at,
        )
    elif settings.IMPERSONATION_INDICATOR_COOKIE_KEY in request.cookies:
        response.delete_cookie(
            settings.USER_SESSION_COOKIE_KEY,
            domain=settings.USER_SESSION_COOKIE_DOMAIN,
        )

    response.delete_cookie(settings.IMPERSONATION_COOKIE_KEY)
    response.delete_cookie(
        settings.IMPERSONATION_INDICATOR_COOKIE_KEY,
        domain=settings.USER_SESSION_COOKIE_DOMAIN,
    )
    return response
