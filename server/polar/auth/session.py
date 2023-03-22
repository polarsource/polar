import uuid
from typing import Literal

import structlog
from fastapi import Request, Response
from fastapi_users import BaseUserManager, UUIDIDMixin
from fastapi_users.authentication import (
    AuthenticationBackend,
    CookieTransport,
    JWTStrategy,
)
from pydantic import BaseModel

from polar.config import settings
from polar.integrations.github.service.user import github_user
from polar.models import User

log = structlog.get_logger()


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):  # type: ignore
    async def oauth_callback(
        self: BaseUserManager[User, uuid.UUID],  # type: ignore
        oauth_name: str,
        access_token: str,
        account_id: str,
        account_email: str,
        expires_at: int | None = None,
        refresh_token: str | None = None,
        request: Request | None = None,
        *,
        associate_by_email: bool = False,
        is_verified_by_default: bool = False
    ) -> User:
        user = await super().oauth_callback(  # type: ignore
            oauth_name,
            access_token,
            account_id,
            account_email,
            expires_at,
            refresh_token,
            request,
            associate_by_email=associate_by_email,
            is_verified_by_default=is_verified_by_default,
        )
        gh_user = await github_user.update_profile(
            self.user_db.session, user, access_token  # type: ignore
        )

        await github_user.sync_github_admin_orgs(self.user_db.session, user)  # type: ignore

        return gh_user

    async def on_after_register(
        self, user: User, request: Request | None = None
    ) -> None:
        # TODO: Send welcome email here?
        log.info("user.registered", user_id=user.id)


class AuthCookieResponse(BaseModel):
    action: Literal["login", "logout"]
    success: bool


class PolarAuthCookie(CookieTransport):
    async def get_login_response(
        self, token: str, response: Response
    ) -> AuthCookieResponse:
        await super().get_login_response(token, response)
        return AuthCookieResponse(action="login", success=True)

    async def get_logout_response(self, response: Response) -> AuthCookieResponse:
        await super().get_logout_response(response)
        return AuthCookieResponse(action="logout", success=True)


def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(
        secret=settings.SECRET,
        lifetime_seconds=60 * 60 * 24 * 31,  # 31 days
    )


cookie_transport = PolarAuthCookie(
    cookie_name="polar",
    cookie_max_age=60 * 60 * 24 * 31,  # 31 days
)
auth_backend = AuthenticationBackend(
    name="jwt",
    transport=cookie_transport,
    get_strategy=get_jwt_strategy,
)
