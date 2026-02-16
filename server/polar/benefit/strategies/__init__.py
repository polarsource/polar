from .base import (
    BenefitActionRequiredError,
    BenefitProperties,
    BenefitPropertiesValidationError,
    BenefitRetriableError,
    BenefitServiceError,
    BenefitServiceProtocol,
)
from .custom.properties import BenefitGrantCustomProperties
from .discord.properties import BenefitGrantDiscordProperties
from .downloadables.properties import BenefitGrantDownloadablesProperties
from .feature_flag.properties import BenefitGrantFeatureFlagProperties
from .github_repository.properties import BenefitGrantGitHubRepositoryProperties
from .license_keys.properties import BenefitGrantLicenseKeysProperties

BenefitGrantProperties = (
    BenefitGrantDiscordProperties
    | BenefitGrantGitHubRepositoryProperties
    | BenefitGrantDownloadablesProperties
    | BenefitGrantLicenseKeysProperties
    | BenefitGrantCustomProperties
    | BenefitGrantFeatureFlagProperties
)

__all__ = [
    "BenefitActionRequiredError",
    "BenefitGrantProperties",
    "BenefitProperties",
    "BenefitPropertiesValidationError",
    "BenefitRetriableError",
    "BenefitServiceError",
    "BenefitServiceProtocol",
]
