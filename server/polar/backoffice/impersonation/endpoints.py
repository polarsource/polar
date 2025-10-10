from datetime import timedelta
from typing import Any

from fastapi import (
    APIRouter,
    Depends,
    Form,
    HTTPException,
    Request,
    status,
)
from fastapi.responses import RedirectResponse
from sqlalchemy import select

from polar.auth.dependencies import WebUserWrite
from polar.auth.scope import Scope
from polar.auth.service import auth as auth_service
from polar.config import settings
from polar.models import (
    User,
    UserSession,
)
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession, get_db_session

from ..responses import HXRedirectResponse

router = APIRouter()


@router.post(
    "/start",
    name="backoffice:start_impersonation",
)
async def start_impersonation(
    request: Request,
    # response: Response,
    auth_subject: WebUserWrite,
    user_id: str = Form(),
    session: AsyncSession = Depends(get_db_session),
) -> Any:  # RedirectResponse | HXRedirectResponse:
    """Start impersonating a user. Only available to admin users."""

    # Check if the current user is an admin
    if not auth_subject.subject.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can impersonate other users",
        )

    # Get the target user
    result = await session.execute(select(User).where(User.id == user_id))
    target_user = result.unique().scalar_one_or_none()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Create a read-only impersonation session for the target user
    token, impersonation_session = await auth_service._create_user_session(
        session=session,
        user=target_user,
        user_agent=request.headers.get("User-Agent", ""),
        scopes=[Scope.web_read],
        expire_in=timedelta(minutes=60),
    )

    # Get the current session token to preserve it
    current_token = request.cookies.get(settings.USER_SESSION_COOKIE_KEY)

    # Create response object
    org_repository = OrganizationRepository.from_session(session)
    user_orgs = await org_repository.get_all_by_user(target_user.id)
    response = HXRedirectResponse(
        request, f"{settings.FRONTEND_BASE_URL}/dashboard/{user_orgs[0].slug}", 307
    )

    # Set admin session cookie
    if (
        current_token
        and auth_subject.session
        and isinstance(auth_subject.session, UserSession)
    ):
        response.set_cookie(
            settings.IMPERSONATION_COOKIE_KEY,
            value=current_token,
            expires=auth_subject.session.expires_at,
            path="/",
            domain=settings.USER_SESSION_COOKIE_DOMAIN,
            secure=True,
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
        secure=True,
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
        secure=True,
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

    # Get the admin session token
    admin_token = request.cookies.get(settings.IMPERSONATION_COOKIE_KEY)
    if not admin_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No admin session found"
        )

    # Get the current impersonated session to delete it
    impersonated_user_id = None
    current_token = request.cookies.get(settings.USER_SESSION_COOKIE_KEY)
    if current_token:
        current_session = await auth_service._get_user_session_by_token(
            session, current_token
        )
        if current_session:
            impersonated_user_id = current_session.user_id
            await session.delete(current_session)

    # Validate the admin session is still valid
    admin_session = await auth_service._get_user_session_by_token(session, admin_token)
    if not admin_session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin session expired or invalid",
        )

    if impersonated_user_id:
        response = RedirectResponse(
            settings.generate_backoffice_url(f"/users/{impersonated_user_id}")
        )
    else:
        response = RedirectResponse(settings.generate_backoffice_url("/"))

    # Restore admin session
    response.set_cookie(
        settings.USER_SESSION_COOKIE_KEY,
        value=admin_token,
        expires=admin_session.expires_at,
        path="/",
        domain=settings.USER_SESSION_COOKIE_DOMAIN,
        secure=True,
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
