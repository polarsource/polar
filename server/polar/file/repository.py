from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, select

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.kit.sorting import Sorting
from polar.models import File, UserOrganization
from polar.models.file import FileServiceTypes

from .sorting import FileSortProperty


class FileRepository(
    RepositorySortingMixin[File, FileSortProperty],
    RepositorySoftDeletionIDMixin[File, UUID],
    RepositorySoftDeletionMixin[File],
    RepositoryBase[File],
):
    model = File

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[File]]:
        statement = self.get_base_statement()

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                File.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                File.organization_id == auth_subject.subject.id,
            )

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

    def get_sorting_clause(self, property: FileSortProperty) -> SortingClause:
        match property:
            case FileSortProperty.created_at:
                return File.created_at
            case FileSortProperty.file_name:
                return File.name
