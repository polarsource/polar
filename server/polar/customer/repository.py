from uuid import UUID

from sqlalchemy import func

from polar.kit.repository import (
    RepositoryBase,
    RepositoryIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Customer


class CustomerRepository(
    RepositoryBase[Customer],
    RepositorySoftDeletionMixin[Customer],
    RepositoryIDMixin[Customer, UUID],
):
    model = Customer

    async def get_by_email_and_organization(
        self, email: str, organization_id: UUID
    ) -> Customer | None:
        statement = self.get_base_statement().where(
            func.lower(Customer.email) == email.lower(),
            Customer.organization_id == organization_id,
        )
        return await self.get_one_or_none(statement)
