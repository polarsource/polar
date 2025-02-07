from typing import Any

from polar.models import Benefit
from polar.models.benefit import (
    BenefitProperties,
    BenefitType,
)
from polar.models.benefit_grant import BenefitGrantPropertiesBase
from polar.postgres import AsyncSession
from polar.redis import Redis

from .strategies.ads.service import BenefitAdsService
from .strategies.base import (
    BenefitActionRequiredError,
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

# class Config(NamedTuple):
#     service: type[BenefitServiceProtocol[Any, Any, Any]]
#     tax: bool
#
#
# class BenefitType(StrEnum):
#     custom = "custom"
#     ads = "ads"
#     discord = "discord"
#     github_repository = "github_repository"
#     downloadables = "downloadables"
#     license_keys = "license_keys"
#
#     @classmethod
#     @functools.cache
#     def mapping(cls) -> dict["BenefitType", Config]:
#         return {
#             cls.custom: Config(BenefitCustomService, tax=True),
#             cls.ads: Config(BenefitAdsService, tax=True),
#             cls.discord: Config(BenefitDiscordService, tax=True),
#             cls.github_repository: Config(BenefitGitHubRepositoryService, tax=True),
#             cls.downloadables: Config(BenefitDownloadablesService, tax=True),
#             cls.license_keys: Config(BenefitLicenseKeysService, tax=True),
#         }
#
#     def is_tax_applicable(self) -> bool:
#         return self.mapping()[self].tax
#
#     @classmethod
#     def get_service(
#         cls, type: "BenefitType", session: AsyncSession, redis: Redis
#     ) -> BenefitServiceProtocol[Benefit, BenefitProperties, BenefitGrantPropertiesBase]:
#         return cls.mapping()[type].service(session, redis)
#

_STRATEGY_CLASS_MAP: dict[
    BenefitType,
    type[BenefitServiceProtocol[Any, Any, Any]],
] = {
    BenefitType.custom: BenefitCustomService,
    BenefitType.ads: BenefitAdsService,
    BenefitType.discord: BenefitDiscordService,
    BenefitType.github_repository: BenefitGitHubRepositoryService,
    BenefitType.downloadables: BenefitDownloadablesService,
    BenefitType.license_keys: BenefitLicenseKeysService,
}


def get_benefit_strategy(
    type: BenefitType, session: AsyncSession, redis: Redis
) -> BenefitServiceProtocol[Benefit, BenefitProperties, BenefitGrantPropertiesBase]:
    return _STRATEGY_CLASS_MAP[type](session, redis)


__all__ = [
    "BenefitActionRequiredError",
    "BenefitServiceProtocol",
    "BenefitPropertiesValidationError",
    "BenefitRetriableError",
    "BenefitServiceError",
    "get_benefit_strategy",
]
