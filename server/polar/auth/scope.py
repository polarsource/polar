from enum import StrEnum

from pydantic import GetJsonSchemaHandler
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import core_schema as cs


class Scope(StrEnum):
    openid = "openid"
    profile = "profile"
    email = "email"
    user_read = "user:read"

    admin = "admin"  # Admin scope. For Polar staff only.
    web_default = "web_default"  # Web default scope. For users logged in on the web.

    organizations_read = "organizations:read"
    organizations_write = "organizations:write"

    checkouts_read = "checkouts:read"
    checkouts_write = "checkouts:write"

    products_read = "products:read"
    products_write = "products:write"

    benefits_read = "benefits:read"
    benefits_write = "benefits:write"

    files_read = "files:read"
    files_write = "files:write"

    subscriptions_read = "subscriptions:read"
    subscriptions_write = "subscriptions:write"

    orders_read = "orders:read"

    metrics_read = "metrics:read"

    articles_read = "articles:read"
    articles_write = "articles:write"

    webhooks_read = "webhooks:read"
    webhooks_write = "webhooks:write"

    external_organizations_read = "external_organizations:read"

    license_keys_read = "license_keys:read"
    license_keys_write = "license_keys:write"

    repositories_read = "repositories:read"
    repositories_write = "repositories:write"

    issues_read = "issues:read"
    issues_write = "issues:write"

    user_benefits_read = "user:benefits:read"
    user_orders_read = "user:orders:read"
    user_subscriptions_read = "user:subscriptions:read"
    user_subscriptions_write = "user:subscriptions:write"
    user_downloadables_read = "user:downloadables:read"
    user_license_keys_read = "user:license_keys:read"
    user_advertisement_campaigns_read = "user:advertisement_campaigns:read"
    user_advertisement_campaigns_write = "user:advertisement_campaigns:write"

    @classmethod
    def __get_pydantic_json_schema__(
        cls, core_schema: cs.CoreSchema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        json_schema = handler(core_schema)
        json_schema = handler.resolve_ref_schema(json_schema)
        json_schema["enumNames"] = SCOPES_SUPPORTED_DISPLAY_NAMES
        return json_schema


RESERVED_SCOPES = {Scope.admin, Scope.web_default}
SCOPES_SUPPORTED = [s.value for s in Scope if s not in RESERVED_SCOPES]
SCOPES_SUPPORTED_DISPLAY_NAMES: dict[Scope, str] = {
    Scope.openid: "OpenID",
    Scope.profile: "Read your profile",
    Scope.email: "Read your email address",
    Scope.web_default: "Web Default",
    Scope.user_read: "User Read",
    Scope.organizations_read: "Read your organizations",
    Scope.organizations_write: "Create or modify organizations",
    Scope.products_read: "Read products",
    Scope.products_write: "Create or modify products",
    Scope.benefits_read: "Read benefits",
    Scope.benefits_write: "Create or modify benefits",
    Scope.files_read: "Read file uploads",
    Scope.files_write: "Create or modify file uploads",
    Scope.subscriptions_read: "Read subscriptions made on your organizations",
    Scope.subscriptions_write: (
        "Create or modify subscriptions made on your organizations"
    ),
    Scope.orders_read: "Read orders made on your organizations",
    Scope.metrics_read: "Read metrics",
    Scope.webhooks_read: "Read webhooks",
    Scope.license_keys_read: "Read license keys",
    Scope.license_keys_write: "Modify license keys",
    Scope.webhooks_write: "Create or modify webhooks",
    Scope.articles_read: "Read posts",
    Scope.articles_write: "Create or modify posts",
    Scope.user_benefits_read: "Read your granted benefits",
    Scope.user_orders_read: "Read your orders",
    Scope.user_subscriptions_read: "Read your subscriptions",
    Scope.user_subscriptions_write: "Create or modify your subscriptions",
    Scope.user_downloadables_read: "Read your downloadable files",
    Scope.user_license_keys_read: "Read license keys you have access to",
    Scope.user_advertisement_campaigns_read: "Read your advertisement campaigns",
    Scope.user_advertisement_campaigns_write: (
        "Create or modify your advertisement campaigns"
    ),
}


def scope_to_set(scope: str) -> set[Scope]:
    return {Scope(x) for x in scope.strip().split()}


def scope_to_list(scope: str) -> list[Scope]:
    return list(scope_to_set(scope))
