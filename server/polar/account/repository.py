import uuid
from uuid import UUID

from sqlalchemy import Select, false, or_, select

from polar.auth.models import AuthSubject, User, is_organization, is_user
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Account, Organization, UserOrganization


class AccountRepository(
    RepositorySoftDeletionIDMixin[Account, UUID],
    RepositorySoftDeletionMixin[Account],
    RepositoryBase[Account],
):
    model = Account

    async def get_by_stripe_id(
        self,
        stripe_id: str,
        *,
        options: Options = (),
        include_deleted: bool = False,
    ) -> Account | None:
        statement = (
            self.get_base_statement(include_deleted=include_deleted)
            .where(Account.stripe_id == stripe_id)
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_by_user(
        self, user: uuid.UUID, *, options: Options = (), include_deleted: bool = False
    ) -> Account | None:
        statement = (
            self.get_base_statement(include_deleted=include_deleted)
            .join(User, onclause=User.account_id == Account.id)
            .where(User.id == user)
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_by_organization(
        self,
        organization: uuid.UUID,
        *,
        options: Options = (),
        include_deleted: bool = False,
    ) -> Account | None:
        statement = (
            self.get_base_statement(include_deleted=include_deleted)
            .join(Organization, onclause=Organization.account_id == Account.id)
            .where(Organization.id == organization)
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Account]]:
        statement = self.get_base_statement()

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                or_(
                    Account.admin_id == user.id,
                    Account.id.in_(
                        select(Organization.account_id)
                        .join(
                            UserOrganization,
                            UserOrganization.organization_id == Organization.id,
                        )
                        .where(
                            UserOrganization.user_id == user.id,
                            UserOrganization.deleted_at.is_(None),
                            Organization.account_id.isnot(None),
                        )
                    ),
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(false())

        return statement
