from typing import Any

from polar.models import (
    Subscription,
    User,
)
from polar.models.subscription_benefit import (
    SubscriptionBenefitAds,
    SubscriptionBenefitAdsProperties,
)

from .base import SubscriptionBenefitServiceProtocol


class SubscriptionBenefitAdsService(
    SubscriptionBenefitServiceProtocol[
        SubscriptionBenefitAds, SubscriptionBenefitAdsProperties
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
        previous_properties: SubscriptionBenefitAdsProperties,
    ) -> bool:
        return False
