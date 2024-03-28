import typing

from authlib.oauth2.rfc6749 import scope_to_list
from authlib.oidc.core import UserInfo

from polar.models import User


def generate_user_info(user: User, scope: str) -> UserInfo:
    scopes = scope_to_list(scope)
    claims: dict[str, typing.Any] = {"sub": str(user.id)}
    if scopes:
        if "profile" in scopes:
            claims.update({"name": user.username})
        if "email" in scopes:
            claims.update({"email": user.email, "email_verified": user.email_verified})
    return UserInfo(**claims)


__all__ = ["generate_user_info", "UserInfo"]
