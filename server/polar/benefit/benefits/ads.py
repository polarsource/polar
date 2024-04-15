from typing import Any, cast

from polar.models import (
    Subscription,
    User,
)
from polar.models.benefit import (
    BenefitAds,
    BenefitAdsProperties,
)

from .base import BenefitServiceProtocol


class BenefitAdsService(BenefitServiceProtocol[BenefitAds, BenefitAdsProperties]):
    async def grant(
        self,
        benefit: BenefitAds,
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
        benefit: BenefitAds,
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
        benefit: BenefitAds,
        previous_properties: BenefitAdsProperties,
    ) -> bool:
        return False

    async def validate_properties(
        self, user: User, properties: dict[str, Any]
    ) -> BenefitAdsProperties:
        return cast(BenefitAdsProperties, properties)
