from uuid import UUID

from sqlalchemy import delete
from sqlalchemy.orm import contains_eager

from polar.kit.crypto import get_token_hash
from polar.kit.repository import RepositoryBase
from polar.kit.utils import utc_now
from polar.models import Customer, CustomerSession


class CustomerSessionRepository(RepositoryBase[CustomerSession]):
    model = CustomerSession

    async def get_by_token(
        self, token: str, *, expired: bool = False
    ) -> CustomerSession | None:
        statement = (
            self.get_base_statement()
            .join(CustomerSession.customer)
            .where(
                CustomerSession.token == get_token_hash(token),
                ~CustomerSession.is_deleted,
                Customer.can_authenticate,
            )
            .options(
                contains_eager(CustomerSession.customer).joinedload(
                    Customer.organization
                )
            )
        )
        if not expired:
            statement = statement.where(CustomerSession.expires_at > utc_now())
        return await self.get_one_or_none(statement)

    async def delete_by_customer_id(self, customer_id: UUID) -> None:
        statement = delete(CustomerSession).where(
            CustomerSession.customer_id == customer_id
        )
        await self.session.execute(statement)

    async def delete_expired(self) -> None:
        statement = delete(CustomerSession).where(
            CustomerSession.expires_at < utc_now()
        )
        await self.session.execute(statement)
