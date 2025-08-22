from fastapi import Depends, Form, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select

from polar.auth.dependencies import WebUser
from polar.auth.scope import Scope
from polar.config import settings
from polar.models import User
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


@router.post(
    "/auth/impersonate/start",
    response_model=ImpersonateResponse,
    name="auth:start_impersonation",
)
async def start_impersonation(
    request: Request,
    response: Response,
    auth_subject: WebUser,
    user_id: str = Form(),
    session: AsyncSession = Depends(get_db_session),
) -> ImpersonateResponse:
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
    )

    # Get the current session token to preserve it
    current_token = request.cookies.get(settings.USER_SESSION_COOKIE_KEY)

    # Set cookies
    # is_localhost = request.url.hostname in ["127.0.0.1", "localhost"]
    # secure = False if is_localhost else True
    secure = True

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
            secure=secure,
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
        secure=secure,
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
        secure=secure,
        httponly=False,  # JS-readable
        samesite="lax",
    )

    await session.commit()

    return ImpersonateResponse(
        success=True, message=f"Now impersonating user {target_user.email}"
    )


@router.post("/auth/impersonate/end", response_model=ImpersonateResponse)
async def end_impersonation(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_db_session),
) -> ImpersonateResponse:
    """End impersonation and restore the admin session."""

    # Get the admin session token
    admin_token = request.cookies.get("admin_polar_session")
    if not admin_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No admin session found"
        )

    # Get the current impersonated session to delete it
    current_token = request.cookies.get(settings.USER_SESSION_COOKIE_KEY)
    if current_token:
        current_session = await auth_service._get_user_session_by_token(
            session, current_token
        )
        if current_session:
            await session.delete(current_session)

    # Validate the admin session is still valid
    admin_session = await auth_service._get_user_session_by_token(session, admin_token)
    if not admin_session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin session expired or invalid",
        )

    is_localhost = request.url.hostname in ["127.0.0.1", "localhost"]
    secure = False if is_localhost else True
    secure = True

    # Restore admin session
    response.set_cookie(
        settings.USER_SESSION_COOKIE_KEY,
        value=admin_token,
        expires=admin_session.expires_at,
        path="/",
        domain=settings.USER_SESSION_COOKIE_DOMAIN,
        secure=secure,
        httponly=True,
        samesite="lax",
    )

    # Remove admin session cookie
    response.delete_cookie(
        "admin_polar_session",
        path="/",
        domain=settings.USER_SESSION_COOKIE_DOMAIN,
    )

    # Remove impersonation indicator cookie
    response.delete_cookie(
        "impersonation",
        path="/",
        domain=settings.USER_SESSION_COOKIE_DOMAIN,
    )

    await session.commit()

    return ImpersonateResponse(
        success=True, message="Impersonation ended, admin session restored"
    )
