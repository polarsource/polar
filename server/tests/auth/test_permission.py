from polar.auth.permission import (
    ROLE_PERMISSIONS,
    OrganizationPermission,
    roles_with_permission,
)
from polar.models.user_organization import OrganizationRole


class TestFinanceRolePermissions:
    """The `finance` role: read + write on sales, read-only on related data
    models, and no permissions for anything else."""

    def test_has_read_and_write_on_sales(self) -> None:
        permissions = ROLE_PERMISSIONS[OrganizationRole.finance]
        assert OrganizationPermission.sales_read in permissions
        assert OrganizationPermission.sales_manage in permissions

    def test_has_read_only_on_related_models(self) -> None:
        permissions = ROLE_PERMISSIONS[OrganizationRole.finance]
        assert OrganizationPermission.finance_read in permissions
        assert OrganizationPermission.customers_read in permissions
        assert OrganizationPermission.products_read in permissions
        assert OrganizationPermission.custom_fields_read in permissions
        assert OrganizationPermission.analytics_read in permissions

    def test_has_no_write_outside_sales(self) -> None:
        permissions = ROLE_PERMISSIONS[OrganizationRole.finance]
        manage_permissions = {
            p for p in OrganizationPermission if p.value.endswith(":manage")
        }
        assert manage_permissions & permissions == {
            OrganizationPermission.sales_manage
        }

    def test_has_no_unrelated_permissions(self) -> None:
        permissions = ROLE_PERMISSIONS[OrganizationRole.finance]
        assert OrganizationPermission.organization_manage not in permissions
        assert OrganizationPermission.members_read not in permissions
        assert OrganizationPermission.members_manage not in permissions
        assert OrganizationPermission.events_ingest not in permissions
        assert OrganizationPermission.finance_manage not in permissions

    def test_grants_sales_access(self) -> None:
        assert OrganizationRole.finance in roles_with_permission(
            OrganizationPermission.sales_read
        )
        assert OrganizationRole.finance in roles_with_permission(
            OrganizationPermission.sales_manage
        )

    def test_does_not_grant_member_management(self) -> None:
        assert OrganizationRole.finance not in roles_with_permission(
            OrganizationPermission.members_manage
        )
