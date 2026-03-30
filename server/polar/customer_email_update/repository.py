from uuid import UUID

from sqlalchemy import delete
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
            )
            .options(
                joinedload(CustomerEmailVerification.customer).joinedload(
                    Customer.organization
                )
            )
        )
        result = await self.session.execute(statement)
        return result.scalars().unique().one_or_none()

    async def delete_by_customer_id(self, customer_id: UUID) -> None:
        statement = delete(CustomerEmailVerification).where(
            CustomerEmailVerification.customer_id == customer_id
        )
        await self.session.execute(statement)

    async def delete(self, record: CustomerEmailVerification) -> None:
        await self.session.delete(record)

    async def delete_expired(self) -> None:
        statement = delete(CustomerEmailVerification).where(
            CustomerEmailVerification.expires_at < utc_now()
        )
        await self.session.execute(statement)
