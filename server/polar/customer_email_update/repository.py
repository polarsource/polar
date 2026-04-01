from uuid import UUID

from sqlalchemy.orm import joinedload

from polar.kit.extensions.sqlalchemy import sql
from polar.kit.repository import RepositoryBase
from polar.kit.utils import utc_now
from polar.models.customer import Customer
from polar.models.customer_email_verification import CustomerEmailVerification


class CustomerEmailVerificationRepository(RepositoryBase[CustomerEmailVerification]):
    model = CustomerEmailVerification

    async def get_valid_by_token_hash(
        self, token_hash: str
    ) -> CustomerEmailVerification | None:
        statement = (
            sql.select(CustomerEmailVerification)
            .where(
                CustomerEmailVerification.token_hash == token_hash,
                CustomerEmailVerification.expires_at > utc_now(),
                CustomerEmailVerification.verified_at.is_(None),
            )
            .options(
                joinedload(CustomerEmailVerification.customer).joinedload(
                    Customer.organization
                )
            )
        )
        result = await self.session.execute(statement)
        return result.scalars().unique().one_or_none()

    async def expire_by_customer_id(self, customer_id: UUID) -> None:
        statement = (
            sql.update(CustomerEmailVerification)
            .where(
                CustomerEmailVerification.customer_id == customer_id,
                CustomerEmailVerification.expires_at > utc_now(),
                CustomerEmailVerification.verified_at.is_(None),
            )
            .values(expires_at=utc_now())
        )
        await self.session.execute(statement)
