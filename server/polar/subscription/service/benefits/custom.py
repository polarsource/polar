from typing import Any, cast

from polar.models import Subscription, User
from polar.models.benefit import (
    BenefitCustom,
    BenefitCustomProperties,
)

from .base import SubscriptionBenefitServiceProtocol


class SubscriptionBenefitCustomService(
    SubscriptionBenefitServiceProtocol[BenefitCustom, BenefitCustomProperties]
):
    async def grant(
        self,
        benefit: BenefitCustom,
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
        benefit: BenefitCustom,
        subscription: Subscription,
        user: User,
        grant_properties: dict[str, Any],
        *,
        attempt: int = 1,
    ) -> dict[str, Any]:
        return {}

    async def requires_update(
        self,
        benefit: BenefitCustom,
        previous_properties: BenefitCustomProperties,
    ) -> bool:
        return False

    async def validate_properties(
        self, user: User, properties: dict[str, Any]
    ) -> BenefitCustomProperties:
        return cast(BenefitCustomProperties, properties)
