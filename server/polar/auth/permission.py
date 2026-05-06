"""
Permission vocabulary for organization-level RBAC.

Authorization is the AND of two checks:

    required_permission ∈ implied_permissions(token.scopes)
                        ∩ permissions(role_in_org)

Two principles guide what lives here:

- The `scope → implied_permissions` map is the bridge between the existing
  token-scope vocabulary and the new fine-grained permission vocabulary.
  Most scopes map identity-style (X → {X}); we only split the bundle where
  role-level granularity is finer than scope-level (notably
  `organizations:write` and `members:write`).

- The `ROLE_PERMISSIONS` table is the role side of the AND-check. `owner`
  and `admin` carry the same permissions; `owner` is distinguished by
  invariants (singularity per org, member-removal exemption), not by
  additional permissions. The `organizations:transfer_ownership`
  permission is reserved for a future self-serve transfer flow and will
  be owner-only when introduced.
"""

from enum import StrEnum

from polar.auth.scope import Scope
from polar.models.user_organization import OrganizationRole


class OrganizationPermission(StrEnum):
    # Org management — split from `organizations:write`.
    organizations_edit_settings = "organizations:edit_settings"
    organizations_delete = "organizations:delete"
    organizations_manage_payout_account = "organizations:manage_payout_account"

    # Member management — split from `members:write`.
    members_read = "members:read"
    members_invite = "members:invite"
    members_remove = "members:remove"
    members_set_role = "members:set_role"

    # Finance — admin-only on the role-permission side.
    transactions_read = "transactions:read"
    transactions_write = "transactions:write"
    payouts_read = "payouts:read"
    payouts_write = "payouts:write"
    wallets_read = "wallets:read"
    wallets_write = "wallets:write"
    disputes_read = "disputes:read"


# Coarse token scope → fine-grained permissions it implies. Splits live here;
# everything else is handled by the identity fallback in
# `implied_permissions()` below.
SCOPE_IMPLIED_PERMISSIONS: dict[Scope, set[OrganizationPermission]] = {
    Scope.organizations_write: {
        OrganizationPermission.organizations_edit_settings,
        OrganizationPermission.organizations_delete,
        OrganizationPermission.organizations_manage_payout_account,
    },
    Scope.members_write: {
        OrganizationPermission.members_invite,
        OrganizationPermission.members_remove,
        OrganizationPermission.members_set_role,
    },
}


def implied_permissions(scopes: set[Scope]) -> set[OrganizationPermission]:
    """
    Map a token's scope set to the set of `OrganizationPermission`s it
    implies. For any scope not in `SCOPE_IMPLIED_PERMISSIONS`, the identity
    rule applies: scope value `X` implies permission `X` if there is one
    matching it by name; otherwise the scope contributes nothing on the
    permission side.
    """
    implied: set[OrganizationPermission] = set()
    for scope in scopes:
        explicit = SCOPE_IMPLIED_PERMISSIONS.get(scope)
        if explicit is not None:
            implied |= explicit
            continue
        try:
            implied.add(OrganizationPermission(scope.value))
        except ValueError:
            # Scope has no corresponding permission (e.g. `openid`,
            # `profile`, `email`, resource scopes whose write half doesn't
            # gate any org-level action). Ignore.
            continue
    return implied


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
