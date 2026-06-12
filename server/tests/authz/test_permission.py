from polar.auth.permission import (
    ROLE_PERMISSIONS,
    SCOPE_PERMISSIONS,
    OrganizationPermission,
    allowed_scopes_for_role,
)
from polar.auth.scope import Scope
from polar.models.user_organization import OrganizationRole
from polar.oauth2.scopes import restrict_scope_to_role

ADMIN_ONLY_SCOPES = {
    Scope.organizations_read,
    Scope.organizations_write,
    Scope.members_write,
    Scope.webhooks_read,
    Scope.webhooks_write,
    Scope.organization_access_tokens_read,
    Scope.organization_access_tokens_write,
    Scope.transactions_read,
    Scope.transactions_write,
    Scope.payouts_read,
    Scope.payouts_write,
}


def test_scope_permissions_covers_every_scope() -> None:
    assert set(SCOPE_PERMISSIONS) == set(Scope)


def test_owner_and_admin_allow_every_scope() -> None:
    assert allowed_scopes_for_role(OrganizationRole.owner) == set(Scope)
    assert allowed_scopes_for_role(OrganizationRole.admin) == set(Scope)


def test_member_excludes_admin_only_scopes() -> None:
    member_scopes = allowed_scopes_for_role(OrganizationRole.member)
    assert set(Scope) - member_scopes == ADMIN_ONLY_SCOPES


def test_member_keeps_resource_scopes() -> None:
    member_scopes = allowed_scopes_for_role(OrganizationRole.member)
    for scope in (
        Scope.products_write,
        Scope.customers_write,
        Scope.orders_write,
        Scope.metrics_read,
        Scope.events_write,
        Scope.members_read,
        Scope.openid,
    ):
        assert scope in member_scopes


def test_member_only_permissions_never_gate_admin_only_scope() -> None:
    member_permissions = ROLE_PERMISSIONS[OrganizationRole.member]
    admin_only = {
        OrganizationPermission.organization_manage,
        OrganizationPermission.members_manage,
        OrganizationPermission.finance_read,
        OrganizationPermission.finance_manage,
    }
    for scope in ADMIN_ONLY_SCOPES:
        assert SCOPE_PERMISSIONS[scope] & admin_only
        assert not SCOPE_PERMISSIONS[scope] <= member_permissions


def test_restrict_scope_to_role_filters_member_scopes() -> None:
    restricted = restrict_scope_to_role(
        "products:write organizations:write transactions:read members:read",
        OrganizationRole.member,
    )
    assert restricted.split() == ["products:write", "members:read"]


def test_restrict_scope_to_role_keeps_all_for_owner() -> None:
    scope = "products:write organizations:write transactions:read"
    assert restrict_scope_to_role(scope, OrganizationRole.owner) == scope
