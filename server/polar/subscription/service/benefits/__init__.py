from typing import Any

from polar.models import SubscriptionBenefit
from polar.models.subscription_benefit import SubscriptionBenefitType
from polar.postgres import AsyncSession

from .base import (
    SB,
    SubscriptionBenefitGrantError,
    SubscriptionBenefitRevokeError,
    SubscriptionBenefitServiceError,
    SubscriptionBenefitServiceProtocol,
)
from .custom import SubscriptionBenefitCustomService

_SERVICE_CLASS_MAP: dict[
    SubscriptionBenefitType,
    type[SubscriptionBenefitServiceProtocol[Any]],
] = {
    SubscriptionBenefitType.custom: SubscriptionBenefitCustomService,
}


def get_subscription_benefit_service(
    type: SubscriptionBenefitType, session: AsyncSession
) -> SubscriptionBenefitServiceProtocol[SubscriptionBenefit]:
    return _SERVICE_CLASS_MAP[type](session)


__all__ = [
    "SubscriptionBenefitServiceProtocol",
    "SubscriptionBenefitGrantError",
    "SubscriptionBenefitRevokeError",
    "SubscriptionBenefitServiceError",
    "get_subscription_benefit_service",
]
