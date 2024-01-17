from typing import Any

from polar.models import (
    Subscription,
    User,
)
from polar.models.subscription_benefit import (
    SubscriptionBenefitAds,
)

from ...schemas import SubscriptionBenefitAdsUpdate
from .base import SubscriptionBenefitServiceProtocol


class SubscriptionBenefitAdsService(
    SubscriptionBenefitServiceProtocol[
        SubscriptionBenefitAds, SubscriptionBenefitAdsUpdate
    ]
):
    async def grant(
        self,
        benefit: SubscriptionBenefitAds,
        subscription: Subscription,
        user: User,
        grant_properties: dict[str, Any],
        *,
        update: bool = False,
        attempt: int = 1,
    ) -> dict[str, Any]:
        # no-op
        return {}

    async def revoke(
        self,
        benefit: SubscriptionBenefitAds,
        subscription: Subscription,
        user: User,
        grant_properties: dict[str, Any],
        *,
        attempt: int = 1,
    ) -> dict[str, Any]:
        # no-op
        return {}

    async def requires_update(
        self,
        benefit: SubscriptionBenefitAds,
        update: SubscriptionBenefitAdsUpdate,
    ) -> bool:
        return False
