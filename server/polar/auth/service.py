from datetime import datetime
from uuid import UUID

import structlog
from fastapi import Request, Response
from fastapi.responses import RedirectResponse

from polar.authz.service import Scope, ScopedSubject
from polar.config import settings
from polar.exceptions import BadRequest
from polar.kit import jwt
from polar.kit.http import get_safe_return_url
from polar.kit.schemas import Schema
from polar.models import User
from polar.personal_access_token.service import personal_access_token_service
from polar.postgres import AsyncSession
from polar.user.service import user as user_service

log = structlog.get_logger()


class LoginResponse(Schema):
    success: bool
    expires_at: datetime
    token: str | None = None


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
    def generate_pat_token(
        cls, pat_id: UUID, expires_at: datetime, scopes: list[Scope]
    ) -> str:
        return jwt.encode(
            data={
                "pat_id": str(pat_id),
                "scopes": ",".join(scopes),
            },
            secret=settings.SECRET,
            expires_at=expires_at,
            type="auth",
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
    def generate_login_json_response(cls, *, user: User) -> LoginResponse:
        (token, expires_at) = cls.generate_token(user=user)
        return LoginResponse(success=True, token=token, expires_at=expires_at)

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
    async def get_user_from_auth_header(
        cls, session: AsyncSession, *, token: str
    ) -> ScopedSubject | None:
        try:
            decoded = jwt.decode_unsafe(token=token, secret=settings.SECRET)

            # TODO: once all tokens have been rotated, replace decode_unsafe above with decode
            if decoded.get("type", "auth") != "auth":
                raise BadRequest("unexpected jwt type")

            # Authorization headers as when forwarded by NextJS serverside and edge.
            # We're passing Cookie contents in the Authorization header.
            if "user_id" in decoded:
                user = await user_service.get(session, id=decoded["user_id"])
                if user:
                    return ScopedSubject(
                        subject=user,
                        scopes=[
                            Scope.web_default
                        ],  # cookie based auth, has full admin scope
                    )

            # Personal Access Token in the Authorization header.
            if "pat_id" in decoded:
                pat = await personal_access_token_service.get(
                    session, id=decoded["pat_id"], load_user=True
                )
                if pat is None:
                    return None

                if "scopes" in decoded:
                    scopes = [Scope(x) for x in decoded["scopes"].split(",")]
                else:
                    scopes = [Scope.web_default]

                await personal_access_token_service.record_usage(session, id=pat.id)

                return ScopedSubject(subject=pat.user, scopes=scopes)

            raise Exception("failed to decode token")
        except (KeyError, jwt.DecodeError, jwt.ExpiredSignatureError):
            return None

    @classmethod
    def generate_logout_response(cls, *, response: Response) -> LogoutResponse:
        cls.set_auth_cookie(response=response, value="", expires=0)
        return LogoutResponse(success=True)
