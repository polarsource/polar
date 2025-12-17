import typing

from authlib.oidc.core import UserInfo

from polar.auth.scope import Scope, scope_to_list

from .sub_type import SubTypeValue, is_sub_organization, is_sub_user


def generate_user_info(sub: SubTypeValue, scope: str) -> UserInfo:
    _, sub_object = sub
    claims: dict[str, typing.Any] = {"sub": str(sub_object.id)}
    scopes = scope_to_list(scope)

    if is_sub_user(sub):
        _, user = sub
        if scopes:
            if Scope.openid in scopes:
                pass
            if Scope.email in scopes:
                claims.update(
                    {"email": user.email, "email_verified": user.email_verified}
                )
    elif is_sub_organization(sub):
        _, organization = sub
        if scopes:
            if Scope.openid in scopes:
                claims.update({"name": organization.slug})
    else:
        raise NotImplementedError()

    return UserInfo(**claims)


__all__ = ["UserInfo", "generate_user_info"]
