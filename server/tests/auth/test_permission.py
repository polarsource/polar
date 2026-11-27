from polar.auth.permission import (
    AGENT_PERMISSIONS,
    ROLE_PERMISSIONS,
    OrganizationPermission,
    roles_with_permission,
)
from polar.models.user_organization import OrganizationRole


def test_finance_role_permissions() -> None:
    assert ROLE_PERMISSIONS[OrganizationRole.finance] == {
        OrganizationPermission.members_read,
        OrganizationPermission.sales_read,
        OrganizationPermission.sales_manage,
        OrganizationPermission.finance_read,
        OrganizationPermission.customers_read,
        OrganizationPermission.products_read,
        OrganizationPermission.custom_fields_read,
        OrganizationPermission.analytics_read,
    }


def test_agent_permissions() -> None:
    assert AGENT_PERMISSIONS == {
        OrganizationPermission.organization_manage,
        OrganizationPermission.catalog_publish,
        OrganizationPermission.products_read,
        OrganizationPermission.products_manage,
        OrganizationPermission.sales_read,
        OrganizationPermission.sales_manage,
        OrganizationPermission.analytics_read,
        OrganizationPermission.events_ingest,
    }


def test_roles_with_finance_read_permission() -> None:
    assert roles_with_permission(OrganizationPermission.finance_read) == {
        OrganizationRole.owner,
        OrganizationRole.admin,
        OrganizationRole.finance,
    }


def test_roles_with_catalog_publish_permission() -> None:
    assert roles_with_permission(OrganizationPermission.catalog_publish) == {
        OrganizationRole.owner,
        OrganizationRole.admin,
    }
