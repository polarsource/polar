from uuid import UUID

from sqlalchemy import Select

from polar.auth.models import AuthSubject, User
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import PayoutAccount


class PayoutAccountRepository(
    RepositorySoftDeletionIDMixin[PayoutAccount, UUID],
    RepositorySoftDeletionMixin[PayoutAccount],
    RepositoryBase[PayoutAccount],
):
    model = PayoutAccount

    async def get_by_stripe_id(
        self,
        stripe_id: str,
        *,
        options: Options = (),
        include_deleted: bool = False,
    ) -> PayoutAccount | None:
        statement = (
            self.get_base_statement(include_deleted=include_deleted)
            .where(PayoutAccount.stripe_id == stripe_id)
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    def get_readable_statement(
        self, auth_subject: AuthSubject[User]
    ) -> Select[tuple[PayoutAccount]]:
        statement = self.get_base_statement()

        user = auth_subject.subject
        statement = statement.where(PayoutAccount.admin_id == user.id)

        return statement
