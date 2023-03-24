import structlog
from fastapi import Response, Request
from fastapi.responses import RedirectResponse
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


class LogoutResponse(Schema):
    success: bool


class AuthService:
    @staticmethod
    def set_auth_cookie(
        *, response: Response, value: str, expires_at: datetime
    ) -> None:
        response.set_cookie(
            settings.AUTH_COOKIE_KEY,
            value=value,
            expires=settings.AUTH_COOKIE_TTL_SECONDS,
            path="/",
            domain=None,
            secure=True,
            httponly=True,
            samesite="lax",
        )

    @classmethod
    def generate_login_response(
        cls, *, response: Response, user: User
    ) -> LoginResponse:
        expires_at = jwt.create_expiration_dt(seconds=settings.AUTH_COOKIE_TTL_SECONDS)
        token = jwt.encode(
            data={
                "user_id": str(user.id),
            },
            secret=settings.SECRET,
            expires_at=expires_at,
        )
        cls.set_auth_cookie(response=response, value=token, expires_at=expires_at)
        return LoginResponse(success=True, expires_at=expires_at)

    @classmethod
    async def get_user_from_auth_cookie(
        cls, session: AsyncSession, *, request: Request
    ) -> User | None:
        auth_cookie = request.cookies.get(settings.AUTH_COOKIE_KEY)
        if not auth_cookie:
            return None

        try:
            token = jwt.decode(token=auth_cookie, secret=settings.SECRET)
            return await user_service.get(session, id=token["user_id"])
        except jwt.DecodeError:
            return None

    @classmethod
    def generate_logout_response(cls, *, response: Response) -> LogoutResponse:
        cls.set_auth_cookie(response=response, value="", expires_at=datetime.utcnow())
        return LogoutResponse(success=True)
