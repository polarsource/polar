from uuid import UUID

from sqlalchemy import ColumnExpressionArgument, func, or_, select

from polar.kit.repository import RepositoryBase
from polar.models import Customer, TrialRedemption


class TrialRedemptionRepository(RepositoryBase[TrialRedemption]):
    model = TrialRedemption

    async def get_first_by_organization_and_hints(
        self,
        organization: UUID,
        customer_email: str | None = None,
        payment_method_fingerprint: str | None = None,
        product: UUID | None = None,
        *,
        customer_id: UUID | None = None,
    ) -> TrialRedemption | None:
        statement = (
            select(TrialRedemption)
            .join(TrialRedemption.customer)
            .where(Customer.organization_id == organization)
        )

        if product is not None:
            statement = statement.where(TrialRedemption.product_id == product)

        clauses: list[ColumnExpressionArgument[bool]] = []

        if customer_id is not None:
            clauses.append(TrialRedemption.customer_id == customer_id)

        if customer_email is not None:
            clauses.append(
                func.lower(TrialRedemption.customer_email) == customer_email.lower()
            )

        if payment_method_fingerprint is not None:
            clauses.append(
                TrialRedemption.payment_method_fingerprint == payment_method_fingerprint
            )

        if not clauses:
            return None

        return await self.get_one_or_none(statement.where(or_(*clauses)).limit(1))
