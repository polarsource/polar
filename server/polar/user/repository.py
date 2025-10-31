from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
)
from polar.kit.repository.base import SortingClause
from polar.models import OAuthAccount, User, UserOrganization
from polar.models.user import OAuthPlatform

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

    async def get_by_stripe_customer_id(
        self,
        stripe_customer_id: str,
        *,
        include_deleted: bool = False,
        included_blocked: bool = False,
    ) -> User | None:
        statement = self.get_base_statement(include_deleted=include_deleted).where(
            User.stripe_customer_id == stripe_customer_id
        )
        if not included_blocked:
            statement = statement.where(User.blocked_at.is_(None))
        return await self.get_one_or_none(statement)

    async def get_by_oauth_account(
        self,
        platform: OAuthPlatform,
        account_id: str,
        *,
        include_deleted: bool = False,
        included_blocked: bool = False,
    ) -> User | None:
        statement = (
            self.get_base_statement(include_deleted=include_deleted)
            .join(User.oauth_accounts)
            .where(
                OAuthAccount.platform == platform,
                OAuthAccount.account_id == account_id,
            )
        )
        if not included_blocked:
            statement = statement.where(User.blocked_at.is_(None))
        return await self.get_one_or_none(statement)

    async def get_by_identity_verification_id(
        self,
        identity_verification_id: str,
        *,
        include_deleted: bool = False,
        included_blocked: bool = False,
    ) -> User | None:
        statement = self.get_base_statement(include_deleted=include_deleted).where(
            User.identity_verification_id == identity_verification_id
        )
        if not included_blocked:
            statement = statement.where(User.blocked_at.is_(None))
        return await self.get_one_or_none(statement)

    async def get_all_by_organization(
        self,
        organization_id: UUID,
        *,
        include_deleted: bool = False,
        included_blocked: bool = False,
    ) -> Sequence[User]:
        statement = (
            self.get_base_statement(include_deleted=include_deleted)
            .join(UserOrganization, UserOrganization.user_id == User.id)
            .where(
                UserOrganization.deleted_at.is_(None),
                UserOrganization.organization_id == organization_id,
            )
        )
        if not included_blocked:
            statement = statement.where(User.blocked_at.is_(None))
        return await self.get_all(statement)

    async def is_organization_member(
        self,
        user_id: UUID,
        organization_id: UUID,
    ) -> bool:
        statement = select(UserOrganization).where(
            UserOrganization.user_id == user_id,
            UserOrganization.organization_id == organization_id,
            UserOrganization.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none() is not None

    def get_sorting_clause(self, property: UserSortProperty) -> SortingClause:
        match property:
            case UserSortProperty.created_at:
                return self.model.created_at
            case UserSortProperty.email:
                return self.model.email
