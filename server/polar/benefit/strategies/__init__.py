from .ads.properties import BenefitGrantAdsProperties
from .base import (
    BenefitActionRequiredError,
    BenefitPropertiesValidationError,
    BenefitRetriableError,
    BenefitServiceError,
    BenefitServiceProtocol,
)
from .custom.properties import BenefitGrantCustomProperties
from .discord.properties import BenefitGrantDiscordProperties
from .downloadables.properties import BenefitGrantDownloadablesProperties
from .github_repository.properties import BenefitGrantGitHubRepositoryProperties
from .license_keys.properties import BenefitGrantLicenseKeysProperties

BenefitGrantProperties = (
    BenefitGrantDiscordProperties
    | BenefitGrantGitHubRepositoryProperties
    | BenefitGrantDownloadablesProperties
    | BenefitGrantLicenseKeysProperties
    | BenefitGrantAdsProperties
    | BenefitGrantCustomProperties
)

__all__ = [
    "BenefitActionRequiredError",
    "BenefitServiceProtocol",
    "BenefitPropertiesValidationError",
    "BenefitRetriableError",
    "BenefitServiceError",
    "BenefitGrantProperties",
]
