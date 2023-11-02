from polar.models import Subscription
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
        *,
        attempt: int = 1,
    ) -> None:
        return

    async def revoke(
        self,
        benefit: SubscriptionBenefitCustom,
        subscription: Subscription,
        *,
        attempt: int = 1,
    ) -> None:
        return

    async def requires_update(
        self,
        benefit: SubscriptionBenefitCustom,
        update: SubscriptionBenefitCustomUpdate,
    ) -> bool:
        return False
