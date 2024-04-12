from typing import Any

from polar.models import Benefit
from polar.models.benefit import (
    BenefitProperties,
    BenefitType,
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
from .github_repository import SubscriptionBenefitGitHubRepositoryService

_SERVICE_CLASS_MAP: dict[
    BenefitType,
    type[SubscriptionBenefitServiceProtocol[Any, Any]],
] = {
    BenefitType.custom: SubscriptionBenefitCustomService,
    BenefitType.articles: SubscriptionBenefitArticlesService,
    BenefitType.ads: SubscriptionBenefitAdsService,
    BenefitType.discord: SubscriptionBenefitDiscordService,
    BenefitType.github_repository: SubscriptionBenefitGitHubRepositoryService,
}


def get_benefit_service(
    type: BenefitType, session: AsyncSession
) -> SubscriptionBenefitServiceProtocol[Benefit, BenefitProperties]:
    return _SERVICE_CLASS_MAP[type](session)


__all__ = [
    "SubscriptionBenefitServiceProtocol",
    "SubscriptionBenefitPropertiesValidationError",
    "SubscriptionBenefitPreconditionError",
    "SubscriptionBenefitRetriableError",
    "SubscriptionBenefitServiceError",
    "get_benefit_service",
]
