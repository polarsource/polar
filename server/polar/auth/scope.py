from enum import StrEnum


class Scope(StrEnum):
    openid = "openid"
    profile = "profile"
    email = "email"
    articles_read = "articles:read"  # article read only scope (used by RSS auth)
    user_read = "user:read"

    admin = "admin"  # Admin scope. For Polar staff only.
    web_default = "web_default"  # Web default scope. For users logged in on the web.

    creator_subscriptions_read = "creator:subscriptions:read"
    creator_subscriptions_write = "creator:subscriptions:write"
    backer_subscriptions_read = "backer:subscriptions:read"
    backer_subscriptions_write = "backer:subscriptions:write"

    creator_webhooks_read = "creator:webhooks:read"
    creator_webhooks_write = "creator:webhooks:write"
    backer_webhooks_read = "backer:webhooks:read"
    backer_webhooks_write = "backer:webhooks:write"


RESERVED_SCOPES = {Scope.admin, Scope.web_default}
SCOPES_SUPPORTED = [s.value for s in Scope if s not in RESERVED_SCOPES]
SCOPES_SUPPORTED_DISPLAY_NAMES: dict[Scope, str] = {
    Scope.openid: "OpenID",
    Scope.profile: "Profile",
    Scope.email: "Email",
    Scope.web_default: "Web Default",
    Scope.articles_read: "Articles Read",
    Scope.user_read: "User Read",
    Scope.creator_subscriptions_read: "Read Subscription Tiers, Benefits and Subscribers",
    Scope.creator_subscriptions_write: "Create or modify Subscription Tiers, Benefits and Subscribers",
    Scope.backer_subscriptions_read: "Read Subscriptions",
    Scope.backer_subscriptions_write: "Create or modify Subscriptions",
}


def scope_to_set(scope: str) -> set[Scope]:
    return {Scope(x) for x in scope.strip().split()}


def scope_to_list(scope: str) -> list[Scope]:
    return list(scope_to_set(scope))
