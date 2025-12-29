from uuid import UUID

from sqlalchemy import select, update

from polar.kit.repository import RepositoryBase, RepositoryIDMixin
from polar.models import DiscountRedemption


class DiscountRedemptionRepository(
    RepositoryBase[DiscountRedemption], RepositoryIDMixin[DiscountRedemption, UUID]
):
    model = DiscountRedemption

    async def set_subscription_by_checkout(
        self, checkout_id: UUID, subscription_id: UUID
    ) -> None:
        statement = (
            update(DiscountRedemption)
            .values(subscription_id=subscription_id)
            .where(DiscountRedemption.checkout_id == checkout_id)
        )
        await self.session.execute(statement)

    async def get_by_subscription_and_discount(
        self, subscription_id: UUID, discount_id: UUID
    ) -> DiscountRedemption | None:
        statement = select(DiscountRedemption).where(
            DiscountRedemption.subscription_id == subscription_id,
            DiscountRedemption.discount_id == discount_id,
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()
