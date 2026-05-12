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

    # Sales — granted to all roles.
    sales_read = "sales:read"

    # Finance — admin-only.
    account_read = "account:read"
    account_write = "account:write"


_ADMIN_ONLY: set[OrganizationPermission] = {
    OrganizationPermission.organization_manage,
    OrganizationPermission.members_manage,
    OrganizationPermission.products_manage,
    OrganizationPermission.account_read,
    OrganizationPermission.account_write,
}

_MEMBER_PERMISSIONS: set[OrganizationPermission] = {
    OrganizationPermission.members_read,
    OrganizationPermission.products_read,
    OrganizationPermission.sales_read,
}

ROLE_PERMISSIONS: dict[OrganizationRole, set[OrganizationPermission]] = {
    OrganizationRole.member: _MEMBER_PERMISSIONS,
    OrganizationRole.admin: _MEMBER_PERMISSIONS | _ADMIN_ONLY,
    OrganizationRole.owner: _MEMBER_PERMISSIONS | _ADMIN_ONLY,
}


def role_has_permission(
    role: OrganizationRole, permission: OrganizationPermission
) -> bool:
    return permission in ROLE_PERMISSIONS[role]


def roles_with_permission(
    permission: OrganizationPermission,
) -> set[OrganizationRole]:
    """Return the set of roles that grant the given permission."""
    return {role for role, perms in ROLE_PERMISSIONS.items() if permission in perms}
