from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import ColumnExpressionArgument, func, or_, select

from polar.kit.pii import hash_pii
from polar.kit.repository import RepositoryBase
from polar.models import Customer, TrialRedemption


class TrialRedemptionRepository(RepositoryBase[TrialRedemption]):
    model = TrialRedemption

    async def get_all_by_organization_and_hints(
        self,
        organization: UUID,
        customer_email: str | None = None,
        payment_method_fingerprint: str | None = None,
        product: UUID | None = None,
    ) -> Sequence[TrialRedemption]:
        statement = (
            select(TrialRedemption)
            .join(TrialRedemption.customer)
            .where(Customer.organization_id == organization)
        )

        if product is not None:
            statement = statement.where(TrialRedemption.product_id == product)

        clauses: list[ColumnExpressionArgument[bool]] = []

        if customer_email is not None:
            clauses.append(
                or_(
                    TrialRedemption.customer_email_hash == hash_pii(customer_email),
                    # Rows written before the hashing backfill hold the address
                    # itself. Drop this once the backfill has run everywhere.
                    func.lower(TrialRedemption.customer_email_hash)
                    == customer_email.lower(),
                )
            )

        if payment_method_fingerprint is not None:
            clauses.append(
                TrialRedemption.payment_method_fingerprint == payment_method_fingerprint
            )

        if clauses:
            statement = statement.where(or_(*clauses))

        return await self.get_all(statement)
