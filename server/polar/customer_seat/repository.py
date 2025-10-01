from collections.abc import Sequence
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.kit.repository import RepositoryBase
from polar.models import CustomerSeat, Subscription

if TYPE_CHECKING:
    from sqlalchemy.orm.strategy_options import _AbstractLoad


class CustomerSeatRepository(RepositoryBase[CustomerSeat]):
    model = CustomerSeat

    async def list_by_subscription_id(
        self, subscription_id: UUID, *, options: tuple["_AbstractLoad", ...] = ()
    ) -> Sequence[CustomerSeat]:
        statement = (
            select(CustomerSeat)
            .where(CustomerSeat.subscription_id == subscription_id)
            .options(*options)
        )
        return await self.get_all(statement)

    async def get_by_invitation_token(
        self, token: str, *, options: tuple["_AbstractLoad", ...] = ()
    ) -> CustomerSeat | None:
        statement = (
            select(CustomerSeat)
            .where(CustomerSeat.invitation_token == token)
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_available_seats_count(self, subscription_id: UUID) -> int:
        subscription_statement = select(Subscription).where(
            Subscription.id == subscription_id
        )
        from polar.subscription.repository import SubscriptionRepository

        subscription_repository = SubscriptionRepository.from_session(self.session)
        subscription = await subscription_repository.get_one_or_none(
            subscription_statement
        )

        if not subscription or subscription.seats is None:
            return 0
        claimed_statement = select(CustomerSeat).where(
            CustomerSeat.subscription_id == subscription_id,
            CustomerSeat.status.in_(["claimed", "pending"]),
        )
        claimed_seats = await self.get_all(claimed_statement)

        return max(0, subscription.seats - len(claimed_seats))

    async def list_by_customer_id(
        self, customer_id: UUID, *, options: tuple["_AbstractLoad", ...] = ()
    ) -> Sequence[CustomerSeat]:
        statement = (
            select(CustomerSeat)
            .where(CustomerSeat.customer_id == customer_id)
            .options(*options)
        )
        return await self.get_all(statement)

    async def get_by_subscription_and_customer(
        self,
        subscription_id: UUID,
        customer_id: UUID,
        *,
        options: tuple["_AbstractLoad", ...] = (),
    ) -> CustomerSeat | None:
        statement = (
            select(CustomerSeat)
            .where(
                CustomerSeat.subscription_id == subscription_id,
                CustomerSeat.customer_id == customer_id,
            )
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    def get_eager_options(self) -> tuple["_AbstractLoad", ...]:
        return (
            joinedload(CustomerSeat.subscription).joinedload(Subscription.product),
            joinedload(CustomerSeat.customer),
        )
