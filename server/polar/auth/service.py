from datetime import datetime, timedelta
from typing import TypeVar

import structlog
from fastapi import Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import delete, select

from polar.auth.scope import Scope
from polar.config import settings
from polar.enums import TokenType
from polar.kit.crypto import generate_token_hash_pair, get_token_hash
from polar.kit.http import get_safe_return_url
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import User, UserSession
from polar.postgres import AsyncSession

log: Logger = structlog.get_logger()

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
            scopes=[Scope.web_read, Scope.web_write],
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
        self,
        session: AsyncSession,
        request: Request,
        cookie: str = settings.USER_SESSION_COOKIE_KEY,
    ) -> UserSession | None:
        token = request.cookies.get(cookie)
        if token is None or not token.isascii():
            return None

        user_session = await self._get_user_session_by_token(session, token)

        if user_session is None:
            return None

        if not user_session.user.can_authenticate:
            return None

        return user_session

    async def delete_expired(self, session: AsyncSession) -> None:
        statement = delete(UserSession).where(UserSession.expires_at < utc_now())
        await session.execute(statement)

    async def revoke_leaked(
        self,
        session: AsyncSession,
        token: str,
        token_type: TokenType,
        *,
        notifier: str,
        url: str | None,
    ) -> bool:
        user_session = await self._get_user_session_by_token(session, token)

        if user_session is None:
            return False

        await session.delete(user_session)

        log.info(
            "Revoke leaked user session token",
            id=user_session.id,
            notifier=notifier,
            url=url,
        )

        return True

    async def _get_user_session_by_token(
        self, session: AsyncSession, token: str, *, expired: bool = False
    ) -> UserSession | None:
        token_hash = get_token_hash(token, secret=settings.SECRET)
        statement = select(UserSession).where(UserSession.token == token_hash)
        if not expired:
            statement = statement.where(UserSession.expires_at > utc_now())
        result = await session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def _create_user_session(
        self,
        session: AsyncSession,
        user: User,
        *,
        user_agent: str,
        scopes: list[Scope],
        expire_in: timedelta = settings.USER_SESSION_TTL,
    ) -> tuple[str, UserSession]:
        token, token_hash = generate_token_hash_pair(
            secret=settings.SECRET, prefix=USER_SESSION_TOKEN_PREFIX
        )
        user_session = UserSession(
            token=token_hash,
            user_agent=user_agent,
            user=user,
            scopes=scopes,
            expires_at=utc_now() + expire_in,
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
