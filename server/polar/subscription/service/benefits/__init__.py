from polar.models.subscription_benefit import SubscriptionBenefitType
from polar.postgres import AsyncSession

from .base import (
    SubscriptionBenefitGrantError,
    SubscriptionBenefitRevokeError,
    SubscriptionBenefitServiceError,
    SubscriptionBenefitServiceProtocol,
)

_SERVICE_CLASS_MAP: dict[
    SubscriptionBenefitType, type[SubscriptionBenefitServiceProtocol]
] = {}


def get_subscription_benefit_service(
    type: SubscriptionBenefitType, session: AsyncSession
) -> SubscriptionBenefitServiceProtocol:
    return _SERVICE_CLASS_MAP[type](session)


__all__ = [
    "SubscriptionBenefitServiceProtocol",
    "SubscriptionBenefitGrantError",
    "SubscriptionBenefitRevokeError",
    "SubscriptionBenefitServiceError",
    "get_subscription_benefit_service",
]
