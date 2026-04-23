import uuid
from uuid import UUID

from sqlalchemy import Select, select

from polar.auth.models import User
from polar.authz.types import AccessibleOrganizationID
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Account, Organization


class AccountRepository(
    RepositorySoftDeletionIDMixin[Account, UUID],
    RepositorySoftDeletionMixin[Account],
    RepositoryBase[Account],
):
    model = Account

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

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[Account]]:
        return self.get_base_statement().where(
            Account.id.in_(
                select(Organization.account_id).where(Organization.id.in_(org_ids))
            )
        )
