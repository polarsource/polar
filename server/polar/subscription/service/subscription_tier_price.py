from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.exceptions import PolarError
from polar.kit.db.postgres import AsyncSession
from polar.kit.services import ResourceServiceReader
from polar.models import (
    SubscriptionTierPrice,
)


class SubscriptionTierPriceError(PolarError): ...


class SubscriptionTierPriceService(ResourceServiceReader[SubscriptionTierPrice]):
    async def get_by_stripe_price_id(
        self, session: AsyncSession, stripe_price_id: str
    ) -> SubscriptionTierPrice | None:
        statement = (
            select(SubscriptionTierPrice)
            .where(SubscriptionTierPrice.stripe_price_id == stripe_price_id)
            .options(joinedload(SubscriptionTierPrice.subscription_tier))
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()


subscription_tier_price = SubscriptionTierPriceService(SubscriptionTierPrice)
