from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, or_

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
)
from polar.kit.repository.base import SortingClause
from polar.models import OAuthAccount, User

from .sorting import UserSortProperty


class UserRepository(
    RepositorySortingMixin[User, UserSortProperty],
    RepositorySoftDeletionIDMixin[User, UUID],
    RepositorySoftDeletionMixin[User],
    RepositoryBase[User],
):
    model = User

    async def get_by_email(
        self,
        email: str,
        *,
        include_deleted: bool = False,
        included_blocked: bool = False,
    ) -> User | None:
        statement = self.get_base_statement(include_deleted=include_deleted).where(
            func.lower(User.email) == email.lower()
        )
        if not included_blocked:
            statement = statement.where(User.blocked_at.is_(None))
        return await self.get_one_or_none(statement)

    async def get_all_by_any_email(
        self,
        email: str,
        *,
        include_deleted: bool = False,
        included_blocked: bool = False,
    ) -> Sequence[User]:
        """Look up all users matching a given email as primary email or OAuth account email."""
        statement = (
            self.get_base_statement(include_deleted=include_deleted)
            .outerjoin(User.oauth_accounts)
            .where(
                or_(
                    func.lower(User.email) == email.lower(),
                    func.lower(OAuthAccount.account_email) == email.lower(),
                )
            )
            .distinct()
        )
        if not included_blocked:
            statement = statement.where(User.blocked_at.is_(None))
        return await self.get_all(statement)

    async def get_by_identity_verification_id(
        self,
        identity_verification_id: str,
        *,
        include_deleted: bool = False,
        included_blocked: bool = False,
        for_update: bool = False,
    ) -> User | None:
        statement = self.get_base_statement(include_deleted=include_deleted).where(
            User.identity_verification_id == identity_verification_id
        )
        if not included_blocked:
            statement = statement.where(User.blocked_at.is_(None))
        if for_update:
            statement = statement.with_for_update(of=User)
        return await self.get_one_or_none(statement)

    def get_sorting_clause(self, property: UserSortProperty) -> SortingClause:
        match property:
            case UserSortProperty.created_at:
                return self.model.created_at
            case UserSortProperty.email:
                return self.model.email
