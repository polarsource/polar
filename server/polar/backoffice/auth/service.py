from urllib.parse import urlsplit
from uuid import UUID

from fastapi import Request, Response
from reauth.authentication_session import (
    AuthenticationSession,
    AuthenticationSessionService,
)
from reauth.factors.oauth2.oidc import OIDCFactor

from polar.config import settings
from polar.kit.crypto import generate_token_hash_pair, get_legacy_secret
from polar.kit.http import is_localhost
from polar.kit.utils import utc_now
from polar.models import BackofficeUser, BackofficeUserSession
from polar.postgres import AsyncSession

from .repository import (
    BackofficeAuthenticationSessionRepository,
    BackofficeUserSessionRepository,
)

AUTHENTICATION_TOKEN_PREFIX = "polar_backoffice_auth_"
USER_SESSION_TOKEN_PREFIX = "polar_backoffice_session_"


class BackofficeAuthenticationSessionService(AuthenticationSessionService):
    def __init__(
        self, repository: BackofficeAuthenticationSessionRepository, factor: OIDCFactor
    ) -> None:
        self.repository = repository
        super().__init__(
            hash_secret=get_legacy_secret(),
            factors={factor},
            token_prefix=AUTHENTICATION_TOKEN_PREFIX,
            lifetime=settings.BACKOFFICE_AUTHENTICATION_SESSION_TTL,
        )

    async def insert(self, authentication_session: AuthenticationSession) -> UUID:
        return await self.repository.insert_session(authentication_session)

    async def get_by_token_hash(self, token_hash: str) -> AuthenticationSession | None:
        return await self.repository.get_by_token_hash(token_hash)

    async def update(self, authentication_session: AuthenticationSession) -> None:
        await self.repository.update_session(authentication_session)

    async def delete(self, authentication_session: AuthenticationSession) -> None:
        await self.repository.delete_session(authentication_session)


def set_cookie(
    request: Request, response: Response, key: str, value: str, max_age: int
) -> None:
    response.set_cookie(
        key,
        value,
        max_age=max_age,
        path=urlsplit(settings.generate_backoffice_url("/")).path.rstrip("/") or "/",
        httponly=True,
        secure=not is_localhost(request),
        samesite="lax",
    )


def get_user_session_token(request: Request) -> str | None:
    token = request.cookies.get(settings.BACKOFFICE_USER_SESSION_COOKIE_KEY, "")
    if token.startswith(USER_SESSION_TOKEN_PREFIX) and token.isascii():
        return token
    return None


async def get_user_session(
    request: Request, session: AsyncSession
) -> BackofficeUserSession | None:
    token = get_user_session_token(request)
    if token is None:
        return None
    return await BackofficeUserSessionRepository.from_session(session).get_active(token)


async def create_user_session(session: AsyncSession, user: BackofficeUser) -> str:
    token, token_hash = generate_token_hash_pair(prefix=USER_SESSION_TOKEN_PREFIX)
    await BackofficeUserSessionRepository.from_session(session).create(
        BackofficeUserSession(
            user=user,
            token_hash=token_hash,
            expires_at=utc_now() + settings.BACKOFFICE_USER_SESSION_TTL,
        ),
        flush=True,
    )
    return token
