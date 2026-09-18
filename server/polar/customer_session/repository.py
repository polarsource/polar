from uuid import UUID

from sqlalchemy import delete
from sqlalchemy.orm import contains_eager

from polar.kit.crypto import get_token_hash_candidates
from polar.kit.repository import RepositoryBase, RepositoryTokenHashMixin
from polar.kit.utils import utc_now
from polar.models import Customer, CustomerSession


class CustomerSessionRepository(
    RepositoryTokenHashMixin[CustomerSession],
    RepositoryBase[CustomerSession],
):
    model = CustomerSession
    token_hash_attribute = "token"

    async def get_by_token(
        self, token: str, *, expired: bool = False
    ) -> CustomerSession | None:
        candidates = get_token_hash_candidates(token)
        statement = (
            self.get_base_statement()
            .join(CustomerSession.customer)
            .where(
                self.token_hash_clause(candidates),
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
        customer_session = await self.get_one_or_none(statement)
        if customer_session is None:
            return None
        return await self.rehash_token(customer_session, candidates)

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
