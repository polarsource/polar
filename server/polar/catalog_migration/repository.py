from uuid import UUID

from sqlalchemy import Select

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.auth.permission import OrganizationPermission
from polar.authz.repository import select_accessible_org_ids
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import CatalogMigration


class CatalogMigrationRepository(
    RepositorySoftDeletionIDMixin[CatalogMigration, UUID],
    RepositorySoftDeletionMixin[CatalogMigration],
    RepositoryBase[CatalogMigration],
):
    model = CatalogMigration

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[CatalogMigration]:
        statement = self.get_base_statement()
        if is_user(auth_subject):
            statement = statement.where(
                CatalogMigration.organization_id.in_(
                    select_accessible_org_ids(
                        auth_subject, permission=OrganizationPermission.sales_read
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                CatalogMigration.organization_id == auth_subject.subject.id
            )
        return statement
