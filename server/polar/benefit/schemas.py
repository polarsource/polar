from typing import Annotated, Literal

from pydantic import UUID4, Discriminator, Field

from polar.benefit.strategies.custom.properties import BenefitGrantCustomProperties
from polar.benefit.strategies.discord.properties import BenefitGrantDiscordProperties
from polar.benefit.strategies.downloadables.properties import (
    BenefitGrantDownloadablesProperties,
)
from polar.benefit.strategies.feature_flag.properties import (
    BenefitGrantFeatureFlagProperties,
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
from polar.benefit.strategies.slack_shared_channel.properties import (
    BenefitGrantSlackSharedChannelProperties,
)
from polar.customer.schemas.customer import CustomerID, ExternalCustomerID
from polar.customer.schemas.customer import CustomerResponse as Customer
from polar.kit.schemas import (
    ClassName,
    MergeJSONSchema,
    MultipleQueryFilter,
    SetSchemaReference,
)
from polar.kit.versioning import QuerySchema, Version
from polar.member.schemas import ExternalMemberID, Member
from polar.models.benefit import BenefitType
from polar.organization.schemas import OrganizationID
from polar.version import V2027_01

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
from .strategies.feature_flag.schemas import (
    BenefitFeatureFlag,
    BenefitFeatureFlagCreate,
    BenefitFeatureFlagUpdate,
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
    BenefitMeterCreditPublic,
    BenefitMeterCreditUpdate,
)
from .strategies.slack_shared_channel.schemas import (
    BenefitSlackSharedChannel,
    BenefitSlackSharedChannelCreate,
    BenefitSlackSharedChannelUpdate,
)

BENEFIT_DESCRIPTION_MIN_LENGTH = 3
BENEFIT_DESCRIPTION_MAX_LENGTH = 42

BenefitID = Annotated[UUID4, MergeJSONSchema({"description": "The benefit ID."})]


BenefitCreate = Annotated[
    BenefitCustomCreate
    | BenefitDiscordCreate
    | BenefitGitHubRepositoryCreate
    | BenefitDownloadablesCreate
    | BenefitLicenseKeysCreate
    | BenefitMeterCreditCreate
    | BenefitFeatureFlagCreate
    | BenefitSlackSharedChannelCreate,
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
    | BenefitFeatureFlagUpdate
    | BenefitSlackSharedChannelUpdate
)


Benefit = Annotated[
    BenefitCustom
    | BenefitDiscord
    | BenefitGitHubRepository
    | BenefitDownloadables
    | BenefitLicenseKeys
    | BenefitMeterCredit
    | BenefitFeatureFlag
    | BenefitSlackSharedChannel,
    Discriminator("type"),
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
    BenefitType.feature_flag: BenefitFeatureFlag,
    BenefitType.slack_shared_channel: BenefitSlackSharedChannel,
}


class BenefitGrant(BenefitGrantBase):
    customer: Customer
    member: Member | None = None
    benefit: "Benefit"
    properties: BenefitGrantProperties


class BenefitGrantWebhookBase(BenefitGrantBase):
    customer: Customer
    member: Member | None = None


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


class BenefitGrantFeatureFlagWebhook(BenefitGrantWebhookBase):
    benefit: BenefitFeatureFlag
    properties: BenefitGrantFeatureFlagProperties
    previous_properties: BenefitGrantFeatureFlagProperties | None = None


class BenefitGrantSlackSharedChannelWebhook(BenefitGrantWebhookBase):
    benefit: BenefitSlackSharedChannel
    properties: BenefitGrantSlackSharedChannelProperties
    previous_properties: BenefitGrantSlackSharedChannelProperties | None = None


BenefitGrantWebhook = Annotated[
    BenefitGrantDiscordWebhook
    | BenefitGrantCustomWebhook
    | BenefitGrantGitHubRepositoryWebhook
    | BenefitGrantDownloadablesWebhook
    | BenefitGrantLicenseKeysWebhook
    | BenefitGrantMeterCreditWebhook
    | BenefitGrantFeatureFlagWebhook
    | BenefitGrantSlackSharedChannelWebhook,
    SetSchemaReference("BenefitGrantWebhook"),
    MergeJSONSchema({"title": "BenefitGrantWebhook"}),
    ClassName("BenefitGrantWebhook"),
]


# Properties that are public (when embedding products benefits in storefront and checkout)


class BenefitCustomPublic(BenefitPublicBase):
    type: Literal[BenefitType.custom]


class BenefitDiscordPublic(BenefitPublicBase):
    type: Literal[BenefitType.discord]


class BenefitGitHubRepositoryPublic(BenefitPublicBase):
    type: Literal[BenefitType.github_repository]


class BenefitDownloadablesPublic(BenefitPublicBase):
    type: Literal[BenefitType.downloadables]


class BenefitLicenseKeysPublic(BenefitPublicBase):
    type: Literal[BenefitType.license_keys]


class BenefitFeatureFlagPublic(BenefitPublicBase):
    type: Literal[BenefitType.feature_flag]


class BenefitSlackSharedChannelPublic(BenefitPublicBase):
    type: Literal[BenefitType.slack_shared_channel]


BenefitPublic = Annotated[
    BenefitCustomPublic
    | BenefitDiscordPublic
    | BenefitGitHubRepositoryPublic
    | BenefitDownloadablesPublic
    | BenefitLicenseKeysPublic
    | BenefitFeatureFlagPublic
    | BenefitSlackSharedChannelPublic
    | BenefitMeterCreditPublic,
    Discriminator("type"),
    SetSchemaReference("BenefitPublic"),
    MergeJSONSchema({"title": "BenefitPublic"}),
    ClassName("BenefitPublic"),
]


class BenefitListParams(QuerySchema):
    organization_id: MultipleQueryFilter[OrganizationID] | None = Field(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    )
    type: MultipleQueryFilter[BenefitType] | None = Field(
        None, title="BenefitType Filter", description="Filter by benefit type."
    )
    id: MultipleQueryFilter[BenefitID] | None = Field(
        None, title="Filter IDs", description="Filter by benefit IDs."
    )
    external_id: Annotated[
        MultipleQueryFilter[str] | None, Version(starting_from=V2027_01)
    ] = Field(
        None, title="ExternalID Filter", description="Filter by benefit external ID."
    )
    exclude_id: MultipleQueryFilter[BenefitID] | None = Field(
        None, title="Exclude IDs", description="Exclude benefits with these IDs."
    )
    query: str | None = Field(None, title="Query", description="Filter by description.")


class BenefitGrantListParams(QuerySchema):
    organization_id: MultipleQueryFilter[OrganizationID] | None = Field(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    )
    customer_id: MultipleQueryFilter[CustomerID] | None = Field(
        None, title="CustomerID Filter", description="Filter by customer ID."
    )
    external_customer_id: MultipleQueryFilter[ExternalCustomerID] | None = Field(
        None,
        title="ExternalCustomerID Filter",
        description="Filter by customer external ID.",
    )
    external_benefit_id: Annotated[
        MultipleQueryFilter[str] | None, Version(starting_from=V2027_01)
    ] = Field(
        None,
        title="ExternalBenefitID Filter",
        description="Filter by benefit external ID.",
    )
    member_id: Annotated[
        MultipleQueryFilter[UUID4] | None, Version(starting_from=V2027_01)
    ] = Field(None, title="MemberID Filter", description="Filter by member ID.")
    external_member_id: Annotated[
        MultipleQueryFilter[ExternalMemberID] | None, Version(starting_from=V2027_01)
    ] = Field(
        None,
        title="ExternalMemberID Filter",
        description="Filter by member external ID.",
    )
    is_granted: bool | None = Field(
        None,
        description="Filter by granted status. If `true`, only granted benefits will be returned. If `false`, only revoked benefits will be returned. ",
    )


class BenefitGrantsParams(QuerySchema):
    is_granted: bool | None = Field(
        None,
        description=(
            "Filter by granted status. "
            "If `true`, only granted benefits will be returned. "
            "If `false`, only revoked benefits will be returned. "
        ),
    )
    customer_id: MultipleQueryFilter[CustomerID] | None = Field(
        None, title="CustomerID Filter", description="Filter by customer."
    )
    member_id: MultipleQueryFilter[UUID4] | None = Field(
        None, title="MemberID Filter", description="Filter by member."
    )
