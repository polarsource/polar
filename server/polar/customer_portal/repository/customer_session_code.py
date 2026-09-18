from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.kit.repository import RepositoryBase
from polar.kit.utils import utc_now
from polar.models import Customer, CustomerSessionCode


class CustomerSessionCodeRepository(RepositoryBase[CustomerSessionCode]):
    model = CustomerSessionCode

    async def get_valid_by_code_hash_for_update(
        self, code_hash: str
    ) -> CustomerSessionCode | None:
        statement = (
            select(CustomerSessionCode)
            .where(
                CustomerSessionCode.expires_at > utc_now(),
                CustomerSessionCode.code == code_hash,
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
