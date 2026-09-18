from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.kit.repository import RepositoryBase, RepositoryTokenHashMixin
from polar.kit.utils import utc_now
from polar.models import Customer, CustomerSessionCode


class CustomerSessionCodeRepository(
    RepositoryTokenHashMixin[CustomerSessionCode],
    RepositoryBase[CustomerSessionCode],
):
    model = CustomerSessionCode
    token_hash_attribute = "code"

    async def get_valid_by_code_for_update(
        self, code: str
    ) -> CustomerSessionCode | None:
        statement = (
            select(CustomerSessionCode)
            .where(
                CustomerSessionCode.expires_at > utc_now(),
                self.token_hash_clause(code),
            )
            .options(
                joinedload(CustomerSessionCode.customer).joinedload(
                    Customer.organization
                )
            )
            .with_for_update(nowait=True, of=CustomerSessionCode)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()
