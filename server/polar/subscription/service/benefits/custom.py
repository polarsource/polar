from polar.models.subscription_benefit import SubscriptionBenefitCustom

from .base import SubscriptionBenefitServiceProtocol


class SubscriptionBenefitCustomService(
    SubscriptionBenefitServiceProtocol[SubscriptionBenefitCustom]
):
    async def grant(self, benefit: SubscriptionBenefitCustom) -> None:
        return

    async def revoke(self, benefit: SubscriptionBenefitCustom) -> None:
        return
