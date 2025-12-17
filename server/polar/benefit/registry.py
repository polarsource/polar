from typing import Any

from polar.models.benefit import BenefitType
from polar.postgres import AsyncSession
from polar.redis import Redis

from .strategies import (
    BenefitActionRequiredError,
    BenefitGrantProperties,
    BenefitProperties,
    BenefitPropertiesValidationError,
    BenefitRetriableError,
    BenefitServiceError,
    BenefitServiceProtocol,
)
from .strategies.custom.service import BenefitCustomService
from .strategies.discord.service import BenefitDiscordService
from .strategies.downloadables.service import BenefitDownloadablesService
from .strategies.github_repository.service import BenefitGitHubRepositoryService
from .strategies.license_keys.service import BenefitLicenseKeysService
from .strategies.meter_credit.service import BenefitMeterCreditService

_STRATEGY_CLASS_MAP: dict[
    BenefitType,
    type[BenefitServiceProtocol[Any, Any]],
] = {
    BenefitType.custom: BenefitCustomService,
    BenefitType.discord: BenefitDiscordService,
    BenefitType.github_repository: BenefitGitHubRepositoryService,
    BenefitType.downloadables: BenefitDownloadablesService,
    BenefitType.license_keys: BenefitLicenseKeysService,
    BenefitType.meter_credit: BenefitMeterCreditService,
}


def get_benefit_strategy(
    type: BenefitType, session: AsyncSession, redis: Redis
) -> BenefitServiceProtocol[BenefitProperties, BenefitGrantProperties]:
    return _STRATEGY_CLASS_MAP[type](session, redis)


__all__ = [
    "BenefitActionRequiredError",
    "BenefitPropertiesValidationError",
    "BenefitRetriableError",
    "BenefitServiceError",
    "BenefitServiceProtocol",
    "get_benefit_strategy",
]
