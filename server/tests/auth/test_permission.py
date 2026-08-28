from polar.auth.permission import (
    ROLE_PERMISSIONS,
    OrganizationPermission,
    roles_with_permission,
)
from polar.models.user_organization import OrganizationRole


def test_finance_role_permissions() -> None:
    assert ROLE_PERMISSIONS[OrganizationRole.finance] == {
        OrganizationPermission.sales_read,
        OrganizationPermission.sales_manage,
        OrganizationPermission.finance_read,
        OrganizationPermission.customers_read,
        OrganizationPermission.products_read,
        OrganizationPermission.custom_fields_read,
        OrganizationPermission.analytics_read,
    }


def test_roles_with_finance_read_permission() -> None:
    assert roles_with_permission(OrganizationPermission.finance_read) == {
        OrganizationRole.owner,
        OrganizationRole.admin,
        OrganizationRole.finance,
    }
