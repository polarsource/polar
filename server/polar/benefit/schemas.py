from typing import Annotated

from pydantic import UUID4, Discriminator

from polar.benefit.strategies.custom.properties import BenefitGrantCustomProperties
from polar.benefit.strategies.discord.properties import BenefitGrantDiscordProperties
from polar.benefit.strategies.downloadables.properties import (
    BenefitGrantDownloadablesProperties,
)
from polar.benefit.strategies.github_repository.properties import (
    BenefitGrantGitHubRepositoryProperties,
)
from polar.benefit.strategies.license_keys.properties import (
    BenefitGrantLicenseKeysProperties,
)
from polar.benefit.strategies.meter_credit.properties import (
    BenefitGrantMeterCreditProperties,
)
from polar.customer.schemas.customer import Customer
from polar.kit.schemas import (
    ClassName,
    MergeJSONSchema,
    SelectorWidget,
    SetSchemaReference,
)
from polar.models.benefit import BenefitType

from .strategies import BenefitGrantProperties
from .strategies.base.schemas import BenefitGrantBase, BenefitPublicBase
from .strategies.custom.schemas import (
    BenefitCustom,
    BenefitCustomCreate,
    BenefitCustomUpdate,
)
from .strategies.discord.schemas import (
    BenefitDiscord,
    BenefitDiscordCreate,
    BenefitDiscordUpdate,
)
from .strategies.downloadables.schemas import (
    BenefitDownloadables,
    BenefitDownloadablesCreate,
    BenefitDownloadablesUpdate,
)
from .strategies.github_repository.schemas import (
    BenefitGitHubRepository,
    BenefitGitHubRepositoryCreate,
    BenefitGitHubRepositoryUpdate,
)
from .strategies.license_keys.schemas import (
    BenefitLicenseKeys,
    BenefitLicenseKeysCreate,
    BenefitLicenseKeysUpdate,
)
from .strategies.meter_credit.schemas import (
    BenefitMeterCredit,
    BenefitMeterCreditCreate,
    BenefitMeterCreditUpdate,
)

BENEFIT_DESCRIPTION_MIN_LENGTH = 3
BENEFIT_DESCRIPTION_MAX_LENGTH = 42

BenefitID = Annotated[
    UUID4,
    MergeJSONSchema({"description": "The benefit ID."}),
    SelectorWidget("/v1/benefits", "Benefit", "description"),
]


BenefitCreate = Annotated[
    BenefitCustomCreate
    | BenefitDiscordCreate
    | BenefitGitHubRepositoryCreate
    | BenefitDownloadablesCreate
    | BenefitLicenseKeysCreate
    | BenefitMeterCreditCreate,
    Discriminator("type"),
    SetSchemaReference("BenefitCreate"),
]


BenefitUpdate = (
    BenefitCustomUpdate
    | BenefitDiscordUpdate
    | BenefitGitHubRepositoryUpdate
    | BenefitDownloadablesUpdate
    | BenefitLicenseKeysUpdate
    | BenefitMeterCreditUpdate
)


Benefit = Annotated[
    BenefitCustom
    | BenefitDiscord
    | BenefitGitHubRepository
    | BenefitDownloadables
    | BenefitLicenseKeys
    | BenefitMeterCredit,
    SetSchemaReference("Benefit"),
    MergeJSONSchema({"title": "Benefit"}),
    ClassName("Benefit"),
]

benefit_schema_map: dict[BenefitType, type[Benefit]] = {
    BenefitType.discord: BenefitDiscord,
    BenefitType.custom: BenefitCustom,
    BenefitType.github_repository: BenefitGitHubRepository,
    BenefitType.downloadables: BenefitDownloadables,
    BenefitType.license_keys: BenefitLicenseKeys,
    BenefitType.meter_credit: BenefitMeterCredit,
}


class BenefitGrant(BenefitGrantBase):
    customer: Customer
    benefit: "Benefit"
    properties: BenefitGrantProperties


class BenefitGrantWebhookBase(BenefitGrantBase):
    customer: Customer


class BenefitGrantDiscordWebhook(BenefitGrantWebhookBase):
    benefit: BenefitDiscord
    properties: BenefitGrantDiscordProperties
    previous_properties: BenefitGrantDiscordProperties | None = None


class BenefitGrantCustomWebhook(BenefitGrantWebhookBase):
    benefit: BenefitCustom
    properties: BenefitGrantCustomProperties
    previous_properties: BenefitGrantCustomProperties | None = None


class BenefitGrantGitHubRepositoryWebhook(BenefitGrantWebhookBase):
    benefit: BenefitGitHubRepository
    properties: BenefitGrantGitHubRepositoryProperties
    previous_properties: BenefitGrantGitHubRepositoryProperties | None = None


class BenefitGrantDownloadablesWebhook(BenefitGrantWebhookBase):
    benefit: BenefitDownloadables
    properties: BenefitGrantDownloadablesProperties
    previous_properties: BenefitGrantDownloadablesProperties | None = None


class BenefitGrantLicenseKeysWebhook(BenefitGrantWebhookBase):
    benefit: BenefitLicenseKeys
    properties: BenefitGrantLicenseKeysProperties
    previous_properties: BenefitGrantLicenseKeysProperties | None = None


class BenefitGrantMeterCreditWebhook(BenefitGrantWebhookBase):
    benefit: BenefitMeterCredit
    properties: BenefitGrantMeterCreditProperties
    previous_properties: BenefitGrantMeterCreditProperties | None = None


BenefitGrantWebhook = Annotated[
    BenefitGrantDiscordWebhook
    | BenefitGrantCustomWebhook
    | BenefitGrantGitHubRepositoryWebhook
    | BenefitGrantDownloadablesWebhook
    | BenefitGrantLicenseKeysWebhook
    | BenefitGrantMeterCreditWebhook,
    SetSchemaReference("BenefitGrantWebhook"),
    MergeJSONSchema({"title": "BenefitGrantWebhook"}),
    ClassName("BenefitGrantWebhook"),
]


# Properties that are public (when embedding products benefits in storefront and checkout)
class BenefitPublic(BenefitPublicBase): ...
