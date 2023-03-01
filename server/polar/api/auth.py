import uuid
from typing import Any, Literal

import structlog
from fastapi import Request, Response
from fastapi_users import BaseUserManager, UUIDIDMixin, models
from fastapi_users.authentication import (
    AuthenticationBackend,
    CookieTransport,
    JWTStrategy,
    Strategy,
)
from httpx_oauth.clients.github import GitHubOAuth2
from pydantic import BaseModel

from polar.actions import github_user
from polar.config import settings
from polar.models import User

log = structlog.get_logger()

github_oauth_client = GitHubOAuth2(
    settings.GITHUB_CLIENT_ID, settings.GITHUB_CLIENT_SECRET
)


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    async def oauth_callback(
        self: "BaseUserManager[models.UOAP, models.ID]",
        oauth_name: str,
        access_token: str,
        account_id: str,
        account_email: str,
        expires_at: int | None = None,
        refresh_token: str | None = None,
        request: Request | None = None,
        *,
        associate_by_email: bool = False
    ) -> User:
        user = await super().oauth_callback(
            oauth_name,
            access_token,
            account_id,
            account_email,
            expires_at,
            refresh_token,
            request,
            associate_by_email=associate_by_email,
        )
        return await github_user.update_profile(
            self.user_db.session, user, access_token
        )

    async def on_after_register(
        self, user: User, request: Request | None = None
    ) -> None:
        # TODO: Send welcome email here?
        log.info("user.registered", user_id=user.id)


class AuthCookieResponse(BaseModel):
    action: Literal["login", "logout"]
    success: bool
    has_organizations: bool | None = False


class PolarAuthCookie(CookieTransport):
    async def get_login_response(
        self, token: str, user: User, response: Response
    ) -> AuthCookieResponse:
        await super().get_login_response(token, response)
        has_organizations = bool(user.organizations)
        return AuthCookieResponse(
            action="login", success=True, has_organizations=has_organizations
        )

    async def get_logout_response(self, response: Response) -> AuthCookieResponse:
        await super().get_logout_response(response)
        return AuthCookieResponse(action="logout", success=True, has_organizations=None)


class PolarAuthBackend(AuthenticationBackend):
    transport: PolarAuthCookie

    async def login(
        self,
        strategy: Strategy[models.UP, models.ID],
        user: User,
        response: Response,
    ) -> Any:
        token = await strategy.write_token(user)  # type: ignore
        return await self.transport.get_login_response(token, user, response)


def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(
        secret=settings.SECRET,
        lifetime_seconds=60 * 60 * 24 * 31,  # 31 days
    )


cookie_transport = PolarAuthCookie(
    cookie_name="polar",
    cookie_max_age=60 * 60 * 24 * 31,  # 31 days
)
auth_backend = PolarAuthBackend(
    name="jwt",
    transport=cookie_transport,
    get_strategy=get_jwt_strategy,
)
