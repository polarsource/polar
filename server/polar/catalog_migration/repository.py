from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, or_

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.auth.permission import OrganizationPermission
from polar.authz.repository import select_accessible_org_ids
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.models import CatalogMigration
from polar.models.catalog_migration import CatalogMigrationStatus

from .sorting import CatalogMigrationSortProperty


class CatalogMigrationRepository(
    RepositorySortingMixin[CatalogMigration, CatalogMigrationSortProperty],
    RepositorySoftDeletionIDMixin[CatalogMigration, UUID],
    RepositorySoftDeletionMixin[CatalogMigration],
    RepositoryBase[CatalogMigration],
):
    model = CatalogMigration

    def get_readable_statement(
        self,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[UUID] | None = None,
        product_id: Sequence[UUID] | None = None,
        status: Sequence[CatalogMigrationStatus] | None = None,
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
        if organization_id is not None:
            statement = statement.where(
                CatalogMigration.organization_id.in_(organization_id)
            )
        if product_id is not None:
            statement = statement.where(
                or_(
                    CatalogMigration.target_product_id.in_(product_id),
                    CatalogMigration.source_product_ids.overlap(product_id),
                )
            )
        if status is not None:
            statement = statement.where(CatalogMigration.status.in_(status))
        return statement

    def get_sorting_clause(
        self, property: CatalogMigrationSortProperty
    ) -> SortingClause:
        match property:
            case CatalogMigrationSortProperty.created_at:
                return CatalogMigration.created_at
