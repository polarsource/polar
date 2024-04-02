import typing

from authlib.oidc.core import UserInfo

from polar.authz.scope import Scope, scope_to_list
from polar.models import User


def generate_user_info(user: User, scope: str) -> UserInfo:
    scopes = scope_to_list(scope)
    claims: dict[str, typing.Any] = {"sub": str(user.id)}
    if scopes:
        if Scope.openid in scopes:
            claims.update({"name": user.username})
        if Scope.email in scopes:
            claims.update({"email": user.email, "email_verified": user.email_verified})
    return UserInfo(**claims)


__all__ = ["generate_user_info", "UserInfo"]
