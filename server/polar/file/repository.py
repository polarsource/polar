from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select

from polar.authz.types import AccessibleOrganizationID
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.kit.sorting import Sorting
from polar.models import File
from polar.models.file import FileServiceTypes

from .sorting import FileSortProperty


class FileRepository(
    RepositorySortingMixin[File, FileSortProperty],
    RepositorySoftDeletionIDMixin[File, UUID],
    RepositorySoftDeletionMixin[File],
    RepositoryBase[File],
):
    model = File

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[File]]:
        statement = self.get_base_statement()
        statement = statement.where(File.organization_id.in_(org_ids))
        return statement

    async def get_all_by_organization(
        self,
        organization_id: UUID,
        *,
        service: FileServiceTypes | None = None,
        sorting: list[Sorting[FileSortProperty]] = [
            (FileSortProperty.created_at, True)
        ],
    ) -> Sequence[File]:
        """Get all files for an organization, optionally filtered by service type."""
        statement = self.get_base_statement().where(
            File.organization_id == organization_id,
            File.is_uploaded.is_(True),
        )

        if service is not None:
            statement = statement.where(File.service == service)

        statement = self.apply_sorting(statement, sorting)

        return await self.get_all(statement)

    async def paginate_by_organization(
        self,
        organization_id: UUID,
        *,
        service: FileServiceTypes | None = None,
        sorting: list[Sorting[FileSortProperty]] = [
            (FileSortProperty.created_at, True)
        ],
        limit: int,
        page: int,
    ) -> tuple[list[File], int]:
        """Get paginated files for an organization, optionally filtered by service type."""
        statement = self.get_base_statement().where(
            File.organization_id == organization_id,
            File.is_uploaded.is_(True),
        )

        if service is not None:
            statement = statement.where(File.service == service)

        statement = self.apply_sorting(statement, sorting)

        return await self.paginate(statement, limit=limit, page=page)

    def get_sorting_clause(self, property: FileSortProperty) -> SortingClause:
        match property:
            case FileSortProperty.created_at:
                return File.created_at
            case FileSortProperty.file_name:
                return File.name
