from enum import StrEnum


class Scope(StrEnum):
    openid = "openid"
    profile = "profile"
    email = "email"
    web_default = "web_default"  # Web default scope. For users logged in on the web.
    articles_read = "articles:read"  # article read only scope (used by RSS auth)
    user_read = "user:read"


SCOPES_SUPPORTED = [s.value for s in Scope]
SCOPES_SUPPORTED_DISPLAY_NAMES: dict[Scope, str] = {
    Scope.openid: "OpenID",
    Scope.profile: "Profile",
    Scope.email: "Email",
    Scope.web_default: "Web Default",
    Scope.articles_read: "Articles Read",
    Scope.user_read: "User Read",
}


def scope_to_list(scope: str) -> list[Scope]:
    return [Scope(x) for x in scope.strip().split()]
