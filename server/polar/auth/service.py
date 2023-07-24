import structlog
from fastapi import Response, Request
from pydantic import validator
from datetime import datetime

from polar.kit import jwt
from polar.kit.schemas import Schema
from polar.config import settings
from polar.models import User
from polar.postgres import AsyncSession
from polar.user.service import user as user_service

log = structlog.get_logger()


class LoginResponse(Schema):
    success: bool
    expires_at: datetime
    token: str | None = None
    goto_url: str | None = None

    @validator("goto_url")
    def goto_polar_url(cls, v: str | None) -> str | None:
        if v is None or v.startswith(settings.FRONTEND_BASE_URL):
            return v

        raise ValueError("goto_url has to belong to polar")


class LogoutResponse(Schema):
    success: bool


class AuthService:
    @staticmethod
    def set_auth_cookie(
        *,
        response: Response,
        value: str,
        secure: bool = True,
    ) -> None:
        response.set_cookie(
            settings.AUTH_COOKIE_KEY,
            value=value,
            expires=settings.AUTH_COOKIE_TTL_SECONDS,
            path="/",
            domain=None,
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
            ),
            expires_at,
        )

    @classmethod
    def generate_login_cookie_response(
        cls,
        *,
        request: Request,
        response: Response,
        user: User,
        goto_url: str | None = None,
    ) -> LoginResponse:
        (token, expires_at) = cls.generate_token(user=user)

        is_localhost = request.url.hostname in ["127.0.0.1", "localhost"]
        secure = False if is_localhost else True

        cls.set_auth_cookie(response=response, value=token, secure=secure)
        return LoginResponse(success=True, expires_at=expires_at, goto_url=goto_url)

    @classmethod
    def generate_login_json_response(cls, *, user: User) -> LoginResponse:
        (token, expires_at) = cls.generate_token(user=user)
        return LoginResponse(success=True, token=token, expires_at=expires_at)

    @classmethod
    async def get_user_from_request(
        cls, session: AsyncSession, *, request: Request
    ) -> User | None:
        token = cls.get_token_from_auth_cookie(request=request)
        if not token:
            token = cls.get_token_from_auth_header(request=request)
            if not token:
                return None

        try:
            decoded = jwt.decode(token=token, secret=settings.SECRET)
            return await user_service.get(session, id=decoded["user_id"])
        except (jwt.DecodeError, jwt.ExpiredSignatureError):
            return None

    @classmethod
    def get_token_from_auth_cookie(cls, *, request: Request) -> str | None:
        return request.cookies.get(settings.AUTH_COOKIE_KEY)

    @classmethod
    def get_token_from_auth_header(cls, *, request: Request) -> str | None:
        auhtorization = request.headers.get("Authorization")
        if not auhtorization:
            return None
        method, token = auhtorization.split(" ", 1)
        if method != "Bearer":
            return None
        return token

    @classmethod
    def generate_logout_response(cls, *, response: Response) -> LogoutResponse:
        cls.set_auth_cookie(response=response, value="")
        return LogoutResponse(success=True)
