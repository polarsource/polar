from datetime import timedelta
from typing import Any
from uuid import UUID

from fastapi import (
    Depends,
    Form,
    HTTPException,
    Request,
    status,
)
from fastapi.responses import RedirectResponse

from polar.auth.scope import READ_ONLY_SCOPES
from polar.auth.service import auth as auth_service
from polar.backoffice.routing import BackofficeRouter
from polar.config import settings
from polar.kit.crypto import get_token_hash
from polar.models import (
    UserSession,
)
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession, get_db_session
from polar.redis import Redis, get_redis
from polar.user.repository import UserRepository

from ..access import (
    RETURN_COOKIE,
    AdminSession,
    OAuthAdminSession,
    is_private_backoffice,
)
from ..dependencies import get_admin
from ..responses import HXRedirectResponse
from .handoff import ImpersonationHandoff
from .handoff import impersonation_handoff as handoff_service

router = BackofficeRouter()


@router.post(
    "/start",
    name="backoffice:start_impersonation",
)
async def start_impersonation(
    request: Request,
    admin_session: AdminSession = Depends(get_admin),
    user_id: str = Form(),
    organization_id: str | None = Form(default=None),
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> Any:  # RedirectResponse | HXRedirectResponse:
    """Start impersonating a user. Only available to admin users."""

    if is_private_backoffice(request):
        assert isinstance(admin_session, OAuthAdminSession)
        try:
            handoff = ImpersonationHandoff(
                oauth_token_id=admin_session.oauth_token.id,
                admin_user_id=admin_session.user_id,
                user_id=UUID(user_id),
                organization_id=UUID(organization_id) if organization_id else None,
            )
        except ValueError as e:
            raise HTTPException(400, "Invalid impersonation target") from e
        code = await handoff_service.create(redis, handoff)
        return HXRedirectResponse(
            request,
            settings.generate_external_url(
                f"/v1/backoffice/impersonation/start?code={code}"
            ),
            303,
        )

    assert isinstance(admin_session, UserSession)
    # Allow non-secure cookies over local http (backoffice dev).
    secure_cookie = request.url.hostname not in ("127.0.0.1", "localhost")

    # Get the target user
    target_user = await UserRepository.from_session(session).get_by_id(UUID(user_id))
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

    admin_token = request.cookies.get(settings.IMPERSONATION_COOKIE_KEY)
    if admin_token:
        token_hash = get_token_hash(admin_token, secret=settings.SECRET)
        if token_hash != admin_session.token:
            admin_token = None
    if not admin_token:
        admin_token = request.cookies.get(settings.USER_SESSION_COOKIE_KEY)

    response = HXRedirectResponse(
        request, f"{settings.FRONTEND_BASE_URL}/dashboard/{target_org.slug}", 307
    )
    response.delete_cookie(RETURN_COOKIE, domain=settings.USER_SESSION_COOKIE_DOMAIN)

    # Set admin session cookie
    if admin_token:
        response.set_cookie(
            settings.IMPERSONATION_COOKIE_KEY,
            value=admin_token,
            expires=admin_session.expires_at,
            path="/",
            domain=settings.USER_SESSION_COOKIE_DOMAIN,
            secure=secure_cookie,
            httponly=True,
            samesite="lax",
        )

    # Set impersonated session cookie
    response.set_cookie(
        settings.USER_SESSION_COOKIE_KEY,
        value=token,
        expires=impersonation_session.expires_at,
        path="/",
        domain=settings.USER_SESSION_COOKIE_DOMAIN,
        secure=secure_cookie,
        httponly=True,
        samesite="lax",
    )

    # Set JS-readable impersonation indicator cookie
    response.set_cookie(
        settings.IMPERSONATION_INDICATOR_COOKIE_KEY,
        value="true",
        expires=impersonation_session.expires_at,
        path="/",
        domain=settings.USER_SESSION_COOKIE_DOMAIN,
        secure=secure_cookie,
        httponly=False,  # JS-readable
        samesite="lax",
    )

    return response


@router.get("/end", name="backoffice:end_impersonation")
async def end_impersonation(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """End impersonation and restore the admin session."""

    if is_private_backoffice(request):
        return RedirectResponse(
            settings.generate_external_url("/v1/backoffice/impersonation/end"), 303
        )
    # Allow non-secure cookies over local http (backoffice dev).
    secure_cookie = request.url.hostname not in ("127.0.0.1", "localhost")

    # Get the admin session token
    admin_token = request.cookies.get(settings.IMPERSONATION_COOKIE_KEY)
    if not admin_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No admin session found"
        )

    # Get the current impersonated session to delete it
    impersonated_org_id = None
    current_token = request.cookies.get(settings.USER_SESSION_COOKIE_KEY)
    if current_token:
        current_session = await auth_service._get_user_session_by_token(
            session, current_token
        )
        if current_session:
            # Impersonation sessions are scoped to a single organization; use it
            # to send the admin back to that organization in the backoffice.
            if current_session.organization_scopes:
                impersonated_org_id = current_session.organization_scopes[
                    0
                ].organization_id
            await session.delete(current_session)

    # Validate the admin session is still valid
    admin_session = await auth_service._get_user_session_by_token(session, admin_token)
    if not admin_session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin session expired or invalid",
        )

    return_path = (
        f"/organizations/{impersonated_org_id}" if impersonated_org_id else "/"
    )
    if request.cookies.get(RETURN_COOKIE) == "1" and settings.BACKOFFICE_PRIVATE_URL:
        response = RedirectResponse(f"{settings.BACKOFFICE_PRIVATE_URL}{return_path}")
    else:
        response = RedirectResponse(settings.generate_backoffice_url(return_path))
    response.delete_cookie(RETURN_COOKIE, domain=settings.USER_SESSION_COOKIE_DOMAIN)

    # Restore admin session
    response.set_cookie(
        settings.USER_SESSION_COOKIE_KEY,
        value=admin_token,
        expires=admin_session.expires_at,
        path="/",
        domain=settings.USER_SESSION_COOKIE_DOMAIN,
        secure=secure_cookie,
        httponly=True,
        samesite="lax",
    )

    # Remove admin session cookie
    response.delete_cookie(
        settings.IMPERSONATION_COOKIE_KEY,
        path="/",
        domain=settings.USER_SESSION_COOKIE_DOMAIN,
    )

    # Remove impersonation indicator cookie
    response.delete_cookie(
        settings.IMPERSONATION_INDICATOR_COOKIE_KEY,
        path="/",
        domain=settings.USER_SESSION_COOKIE_DOMAIN,
    )

    return response
