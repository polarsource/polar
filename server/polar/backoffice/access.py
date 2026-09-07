from dataclasses import dataclass
from uuid import UUID

from fastapi import Request

from polar.auth.scope import Scope
from polar.config import settings
from polar.exceptions import NotPermitted
from polar.models import OAuth2Token, User, UserSession
from polar.oauth2.service.oauth2_token import oauth2_token as oauth2_token_service
from polar.oauth2.sub_type import SubType
from polar.postgres import AsyncSession

SESSION_COOKIE = "__Host-polar_backoffice_session"
RETURN_COOKIE = "polar_private_impersonation"


class BackofficeAuthenticationRequired(Exception): ...


@dataclass(frozen=True)
class OAuthAdminSession:
    oauth_token: OAuth2Token
    user: User

    @property
    def user_id(self) -> UUID:
        return self.user.id


type AdminSession = UserSession | OAuthAdminSession


def is_private_backoffice(request: Request) -> bool:
    return request.scope.get("polar_private_backoffice", False)


def require_tailscale_user(request: Request, user_session: AdminSession) -> None:
    login = request.headers.get("tailscale-user-login", "")
    if not login or login.casefold() != user_session.user.email.casefold():
        raise NotPermitted("Tailscale identity must match the logged-in admin")


def validate_private_token(token: OAuth2Token) -> OAuthAdminSession:
    if (
        token.client_id != settings.BACKOFFICE_OAUTH_CLIENT_ID
        or token.client is None
        or token.client.is_deleted
        or token.sub_type != SubType.user
        or token.user is None
        or not token.user.can_authenticate
        or not token.user.is_admin
        or token.is_expired()
        or token.is_revoked()
        or not {Scope.openid, Scope.email}.issubset(token.scopes)
    ):
        raise NotPermitted("A valid backoffice admin authorization is required")
    return OAuthAdminSession(token, token.user)


async def get_private_session(
    request: Request, session: AsyncSession
) -> OAuthAdminSession | None:
    cookie = request.cookies.get(SESSION_COOKIE)
    if not cookie or not cookie.isascii():
        return None
    token = await oauth2_token_service.get_by_access_token(session, cookie)
    if token is None:
        return None
    return validate_private_token(token)
