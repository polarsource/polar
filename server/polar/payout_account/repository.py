from uuid import UUID

from sqlalchemy import Select, select

from polar.authz.types import AccessibleOrganizationID
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Organization, PayoutAccount


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

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[PayoutAccount]]:
        return self.get_base_statement().where(
            PayoutAccount.id.in_(
                select(Organization.payout_account_id).where(
                    Organization.id.in_(org_ids)
                )
            )
        )
