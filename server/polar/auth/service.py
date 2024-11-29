from datetime import datetime
from typing import TypeVar

from fastapi import Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import delete, select

from polar.config import settings
from polar.kit.crypto import generate_token_hash_pair, get_token_hash
from polar.kit.http import get_safe_return_url
from polar.kit.utils import utc_now
from polar.models import User, UserSession
from polar.postgres import AsyncSession

USER_SESSION_TOKEN_PREFIX = "polar_us_"

R = TypeVar("R", bound=Response)


class AuthService:
    async def get_login_response(
        self,
        session: AsyncSession,
        request: Request,
        user: User,
        *,
        return_to: str | None = None,
    ) -> RedirectResponse:
        token, user_session = await self._create_user_session(
            session=session,
            user=user,
            user_agent=request.headers.get("User-Agent", ""),
        )

        return_url = get_safe_return_url(return_to)
        response = RedirectResponse(return_url, 303)
        response = self._set_user_session_cookie(
            request, response, token, user_session.expires_at
        )
        return response

    async def get_logout_response(
        self, session: AsyncSession, request: Request, user_session: UserSession | None
    ) -> RedirectResponse:
        if user_session is not None:
            await session.delete(user_session)
        response = RedirectResponse(settings.FRONTEND_BASE_URL)
        response = self._set_user_session_cookie(request, response, "", 0)
        return response

    async def authenticate(
        self, session: AsyncSession, request: Request
    ) -> UserSession | None:
        token = request.cookies.get(settings.USER_SESSION_COOKIE_KEY)
        if token is None:
            return None

        token_hash = get_token_hash(token, secret=settings.SECRET)
        statement = select(UserSession).where(
            UserSession.token == token_hash, UserSession.expires_at > utc_now()
        )
        result = await session.execute(statement)
        user_session = result.unique().scalar_one_or_none()

        if user_session is None:
            return None

        return user_session

    async def delete_expired(self, session: AsyncSession) -> None:
        statement = delete(UserSession).where(UserSession.expires_at < utc_now())
        await session.execute(statement)

    async def _create_user_session(
        self, session: AsyncSession, user: User, *, user_agent: str
    ) -> tuple[str, UserSession]:
        token, token_hash = generate_token_hash_pair(
            secret=settings.SECRET, prefix=USER_SESSION_TOKEN_PREFIX
        )
        user_session = UserSession(
            token=token_hash,
            user_agent=user_agent,
            user=user,
        )
        session.add(user_session)
        await session.flush()

        return token, user_session

    def _set_user_session_cookie(
        self, request: Request, response: R, value: str, expires: int | datetime
    ) -> R:
        is_localhost = request.url.hostname in ["127.0.0.1", "localhost"]
        secure = False if is_localhost else True
        response.set_cookie(
            settings.USER_SESSION_COOKIE_KEY,
            value=value,
            expires=expires,
            path="/",
            domain=settings.USER_SESSION_COOKIE_DOMAIN,
            secure=secure,
            httponly=True,
            samesite="lax",
        )
        return response


auth = AuthService()
