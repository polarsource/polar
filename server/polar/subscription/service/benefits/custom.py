from typing import Any

from polar.models import Subscription, User
from polar.models.subscription_benefit import (
    SubscriptionBenefitCustom,
    SubscriptionBenefitCustomProperties,
)

from .base import SubscriptionBenefitServiceProtocol


class SubscriptionBenefitCustomService(
    SubscriptionBenefitServiceProtocol[
        SubscriptionBenefitCustom, SubscriptionBenefitCustomProperties
    ]
):
    async def grant(
        self,
        benefit: SubscriptionBenefitCustom,
        subscription: Subscription,
        user: User,
        grant_properties: dict[str, Any],
        *,
        update: bool = False,
        attempt: int = 1,
    ) -> dict[str, Any]:
        return {}

    async def revoke(
        self,
        benefit: SubscriptionBenefitCustom,
        subscription: Subscription,
        user: User,
        grant_properties: dict[str, Any],
        *,
        attempt: int = 1,
    ) -> dict[str, Any]:
        return {}

    async def requires_update(
        self,
        benefit: SubscriptionBenefitCustom,
        previous_properties: SubscriptionBenefitCustomProperties,
    ) -> bool:
        return False
