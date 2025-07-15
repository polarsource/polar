from typing import Annotated

from pydantic import (
    UUID4,
    Discriminator,
    TypeAdapter,
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
from .strategies.base.schemas import (
    BenefitGrantBase,
    BenefitPublicBase,
)
from .strategies.custom.schemas import (
    BenefitCustom,
    BenefitCustomCreate,
    BenefitCustomSubscriber,
    BenefitCustomUpdate,
)
from .strategies.discord.schemas import (
    BenefitDiscord,
    BenefitDiscordCreate,
    BenefitDiscordSubscriber,
    BenefitDiscordUpdate,
)
from .strategies.downloadables.schemas import (
    BenefitDownloadables,
    BenefitDownloadablesCreate,
    BenefitDownloadablesSubscriber,
    BenefitDownloadablesUpdate,
)
from .strategies.github_repository.schemas import (
    BenefitGitHubRepository,
    BenefitGitHubRepositoryCreate,
    BenefitGitHubRepositorySubscriber,
    BenefitGitHubRepositoryUpdate,
)
from .strategies.license_keys.schemas import (
    BenefitLicenseKeys,
    BenefitLicenseKeysCreate,
    BenefitLicenseKeysSubscriber,
    BenefitLicenseKeysUpdate,
)
from .strategies.meter_credit.schemas import (
    BenefitMeterCredit,
    BenefitMeterCreditCreate,
    BenefitMeterCreditSubscriber,
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
    properties: BenefitGrantProperties


class BenefitGrantWebhook(BenefitGrant):
    benefit: Benefit
    previous_properties: BenefitGrantProperties | None = None


# Properties that are available to subscribers only
BenefitSubscriber = Annotated[
    BenefitDiscordSubscriber
    | BenefitCustomSubscriber
    | BenefitGitHubRepositorySubscriber
    | BenefitDownloadablesSubscriber
    | BenefitLicenseKeysSubscriber
    | BenefitMeterCreditSubscriber,
    Discriminator("type"),
]

BenefitSubscriberAdapter = TypeAdapter[BenefitSubscriber](BenefitSubscriber)


# Properties that are public (when embedding products benefits in storefront and checkout)
class BenefitPublic(BenefitPublicBase): ...
