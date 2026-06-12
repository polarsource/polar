"""
Permission vocabulary for organization-level RBAC.

Authorization is two consecutive gates at the policy site: the existing
token-scope check, and a role-permission check on top.

  1. `required_scope ∈ token.scopes` — unchanged from today.
  2. `required_permission ∈ permissions(role_in_org)` — new in this design.

`OrganizationPermission` is the role-permission vocabulary; `ROLE_PERMISSIONS`
maps each `OrganizationRole` to the set of permissions it grants. `owner` and
`admin` carry the same permissions; `owner` is distinguished from `admin` by
invariants (singularity per org, member-removal exemption), not by additional
permissions. The `organizations:transfer_ownership` permission is reserved
for a future self-serve transfer flow and will be owner-only when introduced.
"""

from enum import StrEnum

from polar.auth.scope import Scope
from polar.models.user_organization import OrganizationRole


class OrganizationPermission(StrEnum):
    # Org management.
    organization_manage = "organization:manage"

    # Member management.
    members_read = "members:read"
    members_manage = "members:manage"

    # Products.
    products_read = "products:read"
    products_manage = "products:manage"

    # Custom fields.
    custom_fields_read = "custom_fields:read"
    custom_fields_manage = "custom_fields:manage"

    # Customers.
    customers_read = "customers:read"
    customers_manage = "customers:manage"

    # Sales — granted to all roles.
    sales_read = "sales:read"
    sales_manage = "sales:manage"

    # Analytics.
    analytics_read = "analytics:read"
    analytics_manage = "analytics:manage"

    # Events — ingest is granted to all roles (apps and integrations
    # commonly run as member-role users); reads/admin go through
    # `analytics:read` / `analytics:manage`.
    events_ingest = "events:ingest"

    # Finance — admin-only.
    finance_read = "finance:read"
    finance_manage = "finance:manage"


_ADMIN_ONLY: set[OrganizationPermission] = {
    OrganizationPermission.organization_manage,
    OrganizationPermission.members_manage,
    OrganizationPermission.finance_read,
    OrganizationPermission.finance_manage,
}

_MEMBER_PERMISSIONS: set[OrganizationPermission] = {
    OrganizationPermission.members_read,
    OrganizationPermission.products_read,
    OrganizationPermission.products_manage,
    OrganizationPermission.custom_fields_read,
    OrganizationPermission.custom_fields_manage,
    OrganizationPermission.customers_read,
    OrganizationPermission.customers_manage,
    OrganizationPermission.sales_read,
    OrganizationPermission.sales_manage,
    OrganizationPermission.analytics_read,
    OrganizationPermission.analytics_manage,
    OrganizationPermission.events_ingest,
}

ROLE_PERMISSIONS: dict[OrganizationRole, set[OrganizationPermission]] = {
    OrganizationRole.member: _MEMBER_PERMISSIONS,
    OrganizationRole.admin: _MEMBER_PERMISSIONS | _ADMIN_ONLY,
    OrganizationRole.owner: _MEMBER_PERMISSIONS | _ADMIN_ONLY,
}


PERMISSION_DENIED_MESSAGE: dict[OrganizationPermission, str] = {
    OrganizationPermission.organization_manage: "You don't have permission to manage the organization",
    OrganizationPermission.members_read: "You don't have permission to view members",
    OrganizationPermission.members_manage: "You don't have permission to manage members",
    OrganizationPermission.products_read: "You don't have permission to view products",
    OrganizationPermission.products_manage: "You don't have permission to manage products",
    OrganizationPermission.custom_fields_read: "You don't have permission to view custom fields",
    OrganizationPermission.custom_fields_manage: "You don't have permission to manage custom fields",
    OrganizationPermission.customers_read: "You don't have permission to view customers",
    OrganizationPermission.customers_manage: "You don't have permission to manage customers",
    OrganizationPermission.sales_read: "You don't have permission to view sales data",
    OrganizationPermission.sales_manage: "You don't have permission to manage sales",
    OrganizationPermission.analytics_read: "You don't have permission to view analytics",
    OrganizationPermission.analytics_manage: "You don't have permission to manage analytics",
    OrganizationPermission.events_ingest: "You don't have permission to ingest events",
    OrganizationPermission.finance_read: "You don't have permission to access financial data",
    OrganizationPermission.finance_manage: "You don't have permission to manage financial data",
}


def roles_with_permission(
    permission: OrganizationPermission,
) -> set[OrganizationRole]:
    """Return the set of roles that grant the given permission."""
    return {role for role, perms in ROLE_PERMISSIONS.items() if permission in perms}


# Maps each API `Scope` to the `OrganizationPermission`s that gate it, so an
# organization-subject token issued by a member can be limited to the scopes
# their role permits (org tokens bypass the role gate at request time, so a
# member would otherwise escalate past their role). A scope is allowed for a
# role iff every permission gating it is held by the role; this is the union of
# permissions enforced by any endpoint reachable with the scope, so a scope
# fronting an admin-only permission anywhere is withheld from members. An empty
# set means no role-permission gates the scope (user-account scopes, or org
# scopes gated only by membership today), so it is allowed for every role.
_O = OrganizationPermission
SCOPE_PERMISSIONS: dict[Scope, set[OrganizationPermission]] = {
    Scope.openid: set(),
    Scope.profile: set(),
    Scope.email: set(),
    Scope.user_read: set(),
    Scope.user_write: set(),
    Scope.notifications_read: set(),
    Scope.notifications_write: set(),
    Scope.notification_recipients_read: set(),
    Scope.notification_recipients_write: set(),
    Scope.customer_portal_read: set(),
    Scope.customer_portal_write: set(),
    Scope.member_sessions_write: set(),
    Scope.wallets_read: set(),
    Scope.wallets_write: set(),
    Scope.customer_sessions_write: set(),
    Scope.organizations_read: {_O.organization_manage},
    Scope.organizations_write: {_O.organization_manage},
    Scope.webhooks_read: {_O.organization_manage},
    Scope.webhooks_write: {_O.organization_manage},
    Scope.organization_access_tokens_read: {_O.organization_manage},
    Scope.organization_access_tokens_write: {_O.organization_manage},
    Scope.members_write: {_O.members_manage},
    Scope.transactions_read: {_O.finance_read},
    Scope.transactions_write: {_O.finance_manage},
    Scope.payouts_read: {_O.finance_read},
    Scope.payouts_write: {_O.finance_manage},
    Scope.members_read: {_O.members_read},
    Scope.products_read: {_O.products_read},
    Scope.products_write: {_O.products_manage},
    Scope.benefits_read: {_O.products_read},
    Scope.benefits_write: {_O.products_manage},
    Scope.discounts_read: {_O.products_read},
    Scope.discounts_write: {_O.products_manage},
    Scope.checkout_links_read: {_O.products_read},
    Scope.checkout_links_write: {_O.products_manage},
    Scope.files_read: {_O.products_read},
    Scope.files_write: {_O.products_manage},
    Scope.meters_read: {_O.products_read},
    Scope.meters_write: {_O.products_manage},
    Scope.license_keys_read: {_O.products_read},
    Scope.license_keys_write: {_O.products_manage},
    Scope.custom_fields_read: {_O.custom_fields_read},
    Scope.custom_fields_write: {_O.custom_fields_manage},
    Scope.customers_read: {_O.customers_read},
    Scope.customers_write: {_O.customers_manage},
    Scope.customer_seats_read: {_O.customers_read},
    Scope.customer_seats_write: {_O.customers_manage},
    Scope.checkouts_read: {_O.sales_read},
    Scope.checkouts_write: {_O.sales_manage},
    Scope.subscriptions_read: {_O.sales_read},
    Scope.subscriptions_write: {_O.sales_manage},
    Scope.orders_read: {_O.sales_read},
    Scope.orders_write: {_O.sales_manage},
    Scope.refunds_read: {_O.sales_read},
    Scope.refunds_write: {_O.sales_manage},
    Scope.payments_read: {_O.sales_read},
    Scope.disputes_read: {_O.sales_read},
    Scope.metrics_read: {_O.analytics_read},
    Scope.metrics_write: {_O.analytics_manage},
    Scope.events_read: {_O.analytics_read},
    Scope.events_write: {_O.events_ingest},
    Scope.customer_meters_read: {_O.analytics_read},
}


def allowed_scopes_for_role(role: OrganizationRole) -> set[Scope]:
    """Return the scopes a role may exercise through an organization-subject
    token: those whose gating permissions are all held by the role."""
    perms = ROLE_PERMISSIONS[role]
    return {scope for scope, required in SCOPE_PERMISSIONS.items() if required <= perms}
