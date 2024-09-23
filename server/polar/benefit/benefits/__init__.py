from typing import Any

from polar.models import Benefit
from polar.models.benefit import (
    BenefitProperties,
    BenefitType,
)
from polar.models.benefit_grant import BenefitGrantPropertiesBase
from polar.postgres import AsyncSession

from .ads import BenefitAdsService
from .articles import BenefitArticlesService
from .base import (
    BenefitPreconditionError,
    BenefitPropertiesValidationError,
    BenefitRetriableError,
    BenefitServiceError,
    BenefitServiceProtocol,
)
from .custom import BenefitCustomService
from .discord import BenefitDiscordService
from .downloadables import BenefitDownloadablesService
from .github_repository import BenefitGitHubRepositoryService
from .license_keys import BenefitLicenseKeysService

_SERVICE_CLASS_MAP: dict[
    BenefitType,
    type[BenefitServiceProtocol[Any, Any, Any]],
] = {
    BenefitType.custom: BenefitCustomService,
    BenefitType.articles: BenefitArticlesService,
    BenefitType.ads: BenefitAdsService,
    BenefitType.discord: BenefitDiscordService,
    BenefitType.github_repository: BenefitGitHubRepositoryService,
    BenefitType.downloadables: BenefitDownloadablesService,
    BenefitType.license_keys: BenefitLicenseKeysService,
}


def get_benefit_service(
    type: BenefitType, session: AsyncSession
) -> BenefitServiceProtocol[Benefit, BenefitProperties, BenefitGrantPropertiesBase]:
    return _SERVICE_CLASS_MAP[type](session)


__all__ = [
    "BenefitServiceProtocol",
    "BenefitPropertiesValidationError",
    "BenefitPreconditionError",
    "BenefitRetriableError",
    "BenefitServiceError",
    "get_benefit_service",
]
