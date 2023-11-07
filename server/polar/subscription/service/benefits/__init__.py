from typing import Any

from polar.models import SubscriptionBenefit
from polar.models.subscription_benefit import SubscriptionBenefitType
from polar.postgres import AsyncSession

from ...schemas import SubscriptionBenefitUpdate
from .base import (
    SubscriptionBenefitPreconditionError,
    SubscriptionBenefitRetriableError,
    SubscriptionBenefitServiceError,
    SubscriptionBenefitServiceProtocol,
)
from .custom import SubscriptionBenefitCustomService

_SERVICE_CLASS_MAP: dict[
    SubscriptionBenefitType,
    type[SubscriptionBenefitServiceProtocol[Any, Any]],
] = {
    SubscriptionBenefitType.custom: SubscriptionBenefitCustomService,
}


def get_subscription_benefit_service(
    type: SubscriptionBenefitType, session: AsyncSession
) -> SubscriptionBenefitServiceProtocol[SubscriptionBenefit, SubscriptionBenefitUpdate]:
    return _SERVICE_CLASS_MAP[type](session)


__all__ = [
    "SubscriptionBenefitServiceProtocol",
    "SubscriptionBenefitPreconditionError",
    "SubscriptionBenefitRetriableError",
    "SubscriptionBenefitServiceError",
    "get_subscription_benefit_service",
]
