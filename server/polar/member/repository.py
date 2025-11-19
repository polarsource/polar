from uuid import UUID

from sqlalchemy import select

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models.customer import Customer
from polar.models.member import Member
from polar.postgres import AsyncSession


class MemberRepository(
    RepositorySoftDeletionIDMixin[Member, UUID],
    RepositorySoftDeletionMixin[Member],
    RepositoryBase[Member],
):
    model = Member

    async def get_by_customer_and_email(
        self,
        session: AsyncSession,
        customer: Customer,
        email: str | None = None,
    ) -> Member | None:
        """
        Get a member by customer and email.

        Returns:
            Member if found, None otherwise
        """
        email = email or customer.email
        statement = select(Member).where(
            Member.customer_id == customer.id,
            Member.email == email,
            Member.deleted_at.is_(None),
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()
