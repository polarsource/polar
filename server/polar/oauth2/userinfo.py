import typing

from authlib.oidc.core import UserInfo

from polar.auth.scope import Scope, scope_to_list
from polar.models import OAuth2Token

from .sub_type import SubTypeValue, is_sub_organization, is_sub_user


def generate_user_info(sub: SubTypeValue, scope: str) -> UserInfo:
    _, sub_object = sub
    claims: dict[str, typing.Any] = {"sub": str(sub_object.id)}
    scopes = scope_to_list(scope)

    if is_sub_user(sub):
        _, user = sub
        if scopes and Scope.email in scopes:
            claims.update({"email": user.email, "email_verified": user.email_verified})
    elif is_sub_organization(sub):
        _, organization = sub
        if scopes and Scope.openid in scopes:
            claims.update({"name": organization.slug})
    else:
        raise NotImplementedError()

    return UserInfo(**claims)


def generate_token_user_info(token: OAuth2Token) -> UserInfo:
    user_info = generate_user_info(
        token.get_sub_type_value(), typing.cast(str, token.scope)
    )
    user_info["resource"] = token.resource
    return user_info


__all__ = ["UserInfo", "generate_token_user_info", "generate_user_info"]
