from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, select

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.kit.repository.base import Options
from polar.models import Account, Organization, User, UserOrganization
from polar.postgres import AsyncSession

from .sorting import OrganizationSortProperty


class OrganizationRepository(
    RepositorySortingMixin[Organization, OrganizationSortProperty],
    RepositorySoftDeletionIDMixin[Organization, UUID],
    RepositorySoftDeletionMixin[Organization],
    RepositoryBase[Organization],
):
    model = Organization

    async def get_by_id(
        self,
        id: UUID,
        *,
        options: Options = (),
        include_deleted: bool = False,
        include_blocked: bool = False,
    ) -> Organization | None:
        statement = (
            self.get_base_statement(include_deleted=include_deleted)
            .where(self.model.id == id)
            .options(*options)
        )

        if not include_blocked:
            statement = statement.where(self.model.blocked_at.is_(None))

        return await self.get_one_or_none(statement)

    async def get_by_slug(self, slug: str) -> Organization | None:
        statement = self.get_base_statement().where(Organization.slug == slug)
        return await self.get_one_or_none(statement)

    async def get_all_by_user(self, user: UUID) -> Sequence[Organization]:
        statement = (
            self.get_base_statement()
            .join(UserOrganization)
            .where(
                UserOrganization.user_id == user,
                UserOrganization.deleted_at.is_(None),
                Organization.blocked_at.is_(None),
            )
        )
        return await self.get_all(statement)

    async def get_all_by_account(
        self, account: UUID, *, options: Options = ()
    ) -> Sequence[Organization]:
        statement = (
            self.get_base_statement()
            .where(
                Organization.account_id == account,
                Organization.blocked_at.is_(None),
            )
            .options(*options)
        )
        return await self.get_all(statement)

    def get_sorting_clause(self, property: OrganizationSortProperty) -> SortingClause:
        match property:
            case OrganizationSortProperty.created_at:
                return self.model.created_at
            case OrganizationSortProperty.slug:
                return self.model.slug
            case OrganizationSortProperty.organization_name:
                return self.model.name

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Organization]]:
        statement = self.get_base_statement().where(Organization.blocked_at.is_(None))

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                Organization.id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Organization.id == auth_subject.subject.id,
            )

        return statement

    async def get_admin_user(
        self, session: AsyncSession, organization: Organization
    ) -> User | None:
        """Get the admin user of the organization from the associated account."""
        if not organization.account_id:
            return None

        statement = (
            select(User)
            .join(Account, Account.admin_id == User.id)
            .where(
                Account.id == organization.account_id,
                User.deleted_at.is_(None),
            )
        )
        result = await session.execute(statement)
        return result.unique().scalar_one_or_none()
