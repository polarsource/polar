from datetime import datetime

import structlog
from fastapi import Request, Response
from fastapi.responses import RedirectResponse

from polar.config import settings
from polar.exceptions import BadRequest
from polar.kit import jwt
from polar.kit.http import get_safe_return_url
from polar.kit.schemas import Schema
from polar.models import User
from polar.postgres import AsyncSession
from polar.user.service.user import user as user_service

log = structlog.get_logger()


class LogoutResponse(Schema):
    success: bool


class AuthService:
    @staticmethod
    def set_auth_cookie(
        *,
        response: Response,
        value: str,
        expires: int = settings.AUTH_COOKIE_TTL_SECONDS,
        secure: bool = True,
    ) -> None:
        response.set_cookie(
            settings.AUTH_COOKIE_KEY,
            value=value,
            expires=expires,
            path="/",
            domain=settings.AUTH_COOKIE_DOMAIN,
            secure=secure,
            httponly=True,
            samesite="lax",
        )

    @classmethod
    def generate_token(cls, user: User) -> tuple[str, datetime]:
        expires_at = jwt.create_expiration_dt(seconds=settings.AUTH_COOKIE_TTL_SECONDS)
        return (
            jwt.encode(
                data={
                    "user_id": str(user.id),
                },
                secret=settings.SECRET,
                expires_at=expires_at,
                type="auth",
            ),
            expires_at,
        )

    @classmethod
    def generate_login_cookie_response(
        cls,
        *,
        request: Request,
        user: User,
        return_to: str | None = None,
    ) -> RedirectResponse:
        token, _ = cls.generate_token(user=user)

        is_localhost = request.url.hostname in ["127.0.0.1", "localhost"]
        secure = False if is_localhost else True

        return_url = get_safe_return_url(return_to)
        response = RedirectResponse(return_url, 303)
        cls.set_auth_cookie(response=response, value=token, secure=secure)
        return response

    @classmethod
    async def get_user_from_cookie(
        cls, session: AsyncSession, *, cookie: str
    ) -> User | None:
        try:
            decoded = jwt.decode_unsafe(token=cookie, secret=settings.SECRET)

            # TODO: once all tokens have been rotated, replace decode_unsafe above with decode
            if decoded.get("type", "auth") != "auth":
                raise BadRequest("unexpected jwt type")

            return await user_service.get(session, id=decoded["user_id"])
        except (KeyError, jwt.DecodeError, jwt.ExpiredSignatureError):
            return None

    @classmethod
    def generate_logout_response(cls, *, response: Response) -> LogoutResponse:
        cls.set_auth_cookie(response=response, value="", expires=0)
        return LogoutResponse(success=True)
