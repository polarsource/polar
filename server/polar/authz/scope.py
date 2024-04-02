from enum import StrEnum


class Scope(StrEnum):
    openid = "openid"
    profile = "profile"
    email = "email"
    web_default = "web_default"  # Web default scope. For users logged in on the web.
    articles_read = "articles:read"  # article read only scope (used by RSS auth)
    user_read = "user:read"
    subscription_tiers_read = "subscription_tiers:read"
    subscription_tiers_write = "subscription_tiers:write"
    subscriptions_read = "subscriptions:read"
    subscriptions_write = "subscriptions:write"


SCOPES_SUPPORTED = [s.value for s in Scope if s != Scope.web_default]
SCOPES_SUPPORTED_DISPLAY_NAMES: dict[Scope, str] = {
    Scope.openid: "OpenID",
    Scope.profile: "Profile",
    Scope.email: "Email",
    Scope.web_default: "Web Default",
    Scope.articles_read: "Articles Read",
    Scope.user_read: "User Read",
    Scope.subscription_tiers_read: "Read your Subscription Tiers and Benefits",
    Scope.subscription_tiers_write: "Modify your Subscription Tiers and Benefits",
    Scope.subscriptions_read: "Read your Subscriptions",
    Scope.subscriptions_write: "Modify your Subscriptions",
}


def scope_to_list(scope: str) -> list[Scope]:
    return [Scope(x) for x in scope.strip().split()]
