from polar.auth.permission import ROLE_PERMISSIONS, OrganizationPermission
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
