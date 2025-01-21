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

    custom_fields_read = "custom_fields:read"
    custom_fields_write = "custom_fields:write"

    discounts_read = "discounts:read"
    discounts_write = "discounts:write"

    checkout_links_read = "checkout_links:read"
    checkout_links_write = "checkout_links:write"

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

    customers_read = "customers:read"
    customers_write = "customers:write"

    customer_sessions_write = "customer_sessions:write"

    orders_read = "orders:read"
    refunds_read = "refunds:read"
    refunds_write = "refunds:write"

    metrics_read = "metrics:read"

    webhooks_read = "webhooks:read"
    webhooks_write = "webhooks:write"

    external_organizations_read = "external_organizations:read"

    license_keys_read = "license_keys:read"
    license_keys_write = "license_keys:write"

    repositories_read = "repositories:read"
    repositories_write = "repositories:write"

    issues_read = "issues:read"
    issues_write = "issues:write"

    customer_portal_read = "customer_portal:read"
    customer_portal_write = "customer_portal:write"

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
    Scope.custom_fields_read: "Read custom fields",
    Scope.custom_fields_write: "Create or modify custom fields",
    Scope.discounts_read: "Read discounts",
    Scope.discounts_write: "Create or modify discounts",
    Scope.checkout_links_read: "Read checkout links",
    Scope.checkout_links_write: "Create or modify checkout links",
    Scope.checkouts_read: "Read checkout sessions",
    Scope.checkouts_write: "Create or modify checkout sessions",
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
    Scope.customers_read: "Read customers",
    Scope.customers_write: "Create or modify customers",
    Scope.orders_read: "Read orders made on your organizations",
    Scope.refunds_read: "Read refunds made on your organizations",
    Scope.refunds_write: "Create or modify refunds",
    Scope.metrics_read: "Read metrics",
    Scope.webhooks_read: "Read webhooks",
    Scope.license_keys_read: "Read license keys",
    Scope.license_keys_write: "Modify license keys",
    Scope.webhooks_write: "Create or modify webhooks",
    Scope.customer_portal_read: "Read your orders, subscriptions and benefits",
    Scope.customer_portal_write: "Create or modify your orders, subscriptions and benefits",
}


def scope_to_set(scope: str) -> set[Scope]:
    return {Scope(x) for x in scope.strip().split()}


def scope_to_list(scope: str) -> list[Scope]:
    return list(scope_to_set(scope))
