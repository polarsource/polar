from fastapi import Request, Response

from polar.config import settings
from polar.exceptions import Unauthorized
from polar.kit.crypto import get_token_hash
from polar.models import UserSession

from ..access import RETURN_COOKIE


def get_admin_token(request: Request, admin_session: UserSession) -> str:
    for key in (
        settings.IMPERSONATION_COOKIE_KEY,
        settings.USER_SESSION_COOKIE_KEY,
    ):
        token = request.cookies.get(key)
        if (
            token
            and token.isascii()
            and get_token_hash(token, secret=settings.SECRET) == admin_session.token
        ):
            return token
    raise Unauthorized("Admin session expired or invalid")


def set_impersonation_cookies(
    response: Response,
    admin_token: str,
    admin_session: UserSession,
    impersonation_token: str,
    impersonation_session: UserSession,
    *,
    secure: bool,
) -> None:
    response.set_cookie(
        settings.IMPERSONATION_COOKIE_KEY,
        value=admin_token,
        expires=admin_session.expires_at,
        path="/",
        domain=settings.USER_SESSION_COOKIE_DOMAIN,
        secure=secure,
        httponly=True,
        samesite="lax",
    )
    response.set_cookie(
        settings.USER_SESSION_COOKIE_KEY,
        value=impersonation_token,
        expires=impersonation_session.expires_at,
        path="/",
        domain=settings.USER_SESSION_COOKIE_DOMAIN,
        secure=secure,
        httponly=True,
        samesite="lax",
    )
    response.set_cookie(
        settings.IMPERSONATION_INDICATOR_COOKIE_KEY,
        value="true",
        expires=impersonation_session.expires_at,
        path="/",
        domain=settings.USER_SESSION_COOKIE_DOMAIN,
        secure=secure,
        httponly=False,
        samesite="lax",
    )


def restore_admin_cookies(
    response: Response,
    admin_token: str,
    admin_session: UserSession,
    *,
    secure: bool,
) -> None:
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
    for key in (
        settings.IMPERSONATION_COOKIE_KEY,
        settings.IMPERSONATION_INDICATOR_COOKIE_KEY,
        RETURN_COOKIE,
    ):
        response.delete_cookie(key, domain=settings.USER_SESSION_COOKIE_DOMAIN)
