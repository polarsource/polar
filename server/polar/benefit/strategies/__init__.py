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
from .github_repository.properties import BenefitGrantGitHubRepositoryProperties
from .license_keys.properties import BenefitGrantLicenseKeysProperties

BenefitGrantProperties = (
    BenefitGrantDiscordProperties
    | BenefitGrantGitHubRepositoryProperties
    | BenefitGrantDownloadablesProperties
    | BenefitGrantLicenseKeysProperties
    | BenefitGrantCustomProperties
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
