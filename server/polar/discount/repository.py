from uuid import UUID

from sqlalchemy import select, update

from polar.kit.repository import RepositoryBase, RepositoryIDMixin
from polar.models import Discount, DiscountRedemption


class DiscountRepository(RepositoryBase[Discount], RepositoryIDMixin[Discount, UUID]):
    model = Discount

    async def get_by_id_for_update(
        self, discount_id: UUID, *, nowait: bool = True
    ) -> Discount | None:
        """Get discount by ID with FOR UPDATE lock."""
        statement = (
            select(Discount)
            .where(Discount.id == discount_id, Discount.deleted_at.is_(None))
            .with_for_update(nowait=nowait)
        )
        return await self.get_one_or_none(statement)


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
