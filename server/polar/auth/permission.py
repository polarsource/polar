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
    organizations_edit_settings = "organizations:edit_settings"
    organizations_delete = "organizations:delete"
    organizations_manage_payout_account = "organizations:manage_payout_account"

    # Member management.
    members_read = "members:read"
    members_invite = "members:invite"
    members_remove = "members:remove"
    members_set_role = "members:set_role"

    # Finance — admin-only.
    transactions_read = "transactions:read"
    transactions_write = "transactions:write"
    payouts_read = "payouts:read"
    payouts_write = "payouts:write"
    wallets_read = "wallets:read"
    wallets_write = "wallets:write"
    disputes_read = "disputes:read"


_ADMIN_ONLY: set[OrganizationPermission] = {
    OrganizationPermission.organizations_edit_settings,
    OrganizationPermission.organizations_delete,
    OrganizationPermission.organizations_manage_payout_account,
    OrganizationPermission.members_invite,
    OrganizationPermission.members_remove,
    OrganizationPermission.members_set_role,
    OrganizationPermission.transactions_read,
    OrganizationPermission.transactions_write,
    OrganizationPermission.payouts_read,
    OrganizationPermission.payouts_write,
    OrganizationPermission.wallets_read,
    OrganizationPermission.wallets_write,
    OrganizationPermission.disputes_read,
}

_MEMBER_PERMISSIONS: set[OrganizationPermission] = {
    OrganizationPermission.members_read,
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
