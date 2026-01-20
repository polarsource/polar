from sqlalchemy import Select, select
from sqlalchemy.orm import joinedload

from polar.kit.repository import RepositoryBase
from polar.kit.utils import utc_now
from polar.models import Customer, CustomerSessionCode


class CustomerSessionCodeRepository(RepositoryBase[CustomerSessionCode]):
    model = CustomerSessionCode

    def get_valid_by_code_hash_statement(
        self, code_hash: str
    ) -> Select[tuple[CustomerSessionCode]]:
        """Get a valid (non-expired) CustomerSessionCode by its hash."""
        return (
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
        )

    async def get_valid_by_code_hash(
        self, code_hash: str
    ) -> CustomerSessionCode | None:
        """Get a valid (non-expired) CustomerSessionCode by its hash."""
        statement = self.get_valid_by_code_hash_statement(code_hash)
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()
