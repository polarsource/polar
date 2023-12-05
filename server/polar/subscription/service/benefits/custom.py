from typing import Any

from polar.models import Subscription, User
from polar.models.subscription_benefit import SubscriptionBenefitCustom

from ...schemas import SubscriptionBenefitCustomUpdate
from .base import SubscriptionBenefitServiceProtocol


class SubscriptionBenefitCustomService(
    SubscriptionBenefitServiceProtocol[
        SubscriptionBenefitCustom, SubscriptionBenefitCustomUpdate
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
        update: SubscriptionBenefitCustomUpdate,
    ) -> bool:
        return False
