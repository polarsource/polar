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
    OrganizationPermission.products_manage,
    OrganizationPermission.custom_fields_manage,
    OrganizationPermission.customers_manage,
    OrganizationPermission.analytics_manage,
    OrganizationPermission.finance_read,
    OrganizationPermission.finance_manage,
}

_MEMBER_PERMISSIONS: set[OrganizationPermission] = {
    OrganizationPermission.members_read,
    OrganizationPermission.products_read,
    OrganizationPermission.custom_fields_read,
    OrganizationPermission.customers_read,
    OrganizationPermission.sales_read,
    OrganizationPermission.analytics_read,
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
