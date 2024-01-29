from typing import Any

from polar.models import SubscriptionBenefit
from polar.models.subscription_benefit import (
    SubscriptionBenefitProperties,
    SubscriptionBenefitType,
)
from polar.postgres import AsyncSession
from polar.subscription.service.benefits.ads import SubscriptionBenefitAdsService

from .articles import SubscriptionBenefitArticlesService
from .base import (
    SubscriptionBenefitPreconditionError,
    SubscriptionBenefitPropertiesValidationError,
    SubscriptionBenefitRetriableError,
    SubscriptionBenefitServiceError,
    SubscriptionBenefitServiceProtocol,
)
from .custom import SubscriptionBenefitCustomService
from .discord import SubscriptionBenefitDiscordService

_SERVICE_CLASS_MAP: dict[
    SubscriptionBenefitType,
    type[SubscriptionBenefitServiceProtocol[Any, Any]],
] = {
    SubscriptionBenefitType.custom: SubscriptionBenefitCustomService,
    SubscriptionBenefitType.articles: SubscriptionBenefitArticlesService,
    SubscriptionBenefitType.ads: SubscriptionBenefitAdsService,
    SubscriptionBenefitType.discord: SubscriptionBenefitDiscordService,
}


def get_subscription_benefit_service(
    type: SubscriptionBenefitType, session: AsyncSession
) -> SubscriptionBenefitServiceProtocol[
    SubscriptionBenefit, SubscriptionBenefitProperties
]:
    return _SERVICE_CLASS_MAP[type](session)


__all__ = [
    "SubscriptionBenefitServiceProtocol",
    "SubscriptionBenefitPropertiesValidationError",
    "SubscriptionBenefitPreconditionError",
    "SubscriptionBenefitRetriableError",
    "SubscriptionBenefitServiceError",
    "get_subscription_benefit_service",
]
