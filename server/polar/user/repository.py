from uuid import UUID

from sqlalchemy import func

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import OAuthAccount, User
from polar.models.user import OAuthPlatform


class UserRepository(
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
                OAuthAccount.deleted_at.is_(None),
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
