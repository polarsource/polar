from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.orm import raiseload

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
            .where(Discount.id == discount_id, Discount.is_deleted.is_(False))
            .with_for_update(nowait=nowait)
            .options(raiseload(Discount.organization))
        )
        return await self.get_one_or_none(statement)

    async def get_by_code_and_organization_for_update(
        self,
        code: str,
        organization_id: UUID,
        *,
        nowait: bool = False,
    ) -> Discount | None:
        """Get discount by code and organization with FOR UPDATE lock."""
        statement = (
            select(Discount)
            .where(
                func.upper(Discount.code) == code.upper(),
                Discount.organization_id == organization_id,
                Discount.is_deleted.is_(False),
            )
            .with_for_update(nowait=nowait)
            .options(raiseload(Discount.organization))
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
