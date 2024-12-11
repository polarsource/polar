from datetime import datetime
from typing import Annotated, Literal, TypedDict

from pydantic import UUID4, Discriminator, TypeAdapter

from polar.benefit.schemas import (
    BenefitAdsSubscriber,
    BenefitCustomSubscriber,
    BenefitDiscordSubscriber,
    BenefitDownloadablesSubscriber,
    BenefitGitHubRepositorySubscriber,
    BenefitLicenseKeysSubscriber,
)
from polar.kit.schemas import (
    ClassName,
    IDSchema,
    MergeJSONSchema,
    Schema,
    SetSchemaReference,
    TimestampedSchema,
)
from polar.models.benefit import BenefitType
from polar.models.benefit_grant import (
    BenefitGrantAdsProperties,
    BenefitGrantCustomProperties,
    BenefitGrantDiscordProperties,
    BenefitGrantDownloadablesProperties,
    BenefitGrantGitHubRepositoryProperties,
    BenefitGrantLicenseKeysProperties,
)
from polar.models.customer import CustomerOAuthPlatform


class CustomerBenefitGrantBase(IDSchema, TimestampedSchema):
    granted_at: datetime | None
    revoked_at: datetime | None
    customer_id: UUID4
    benefit_id: UUID4
    subscription_id: UUID4 | None
    order_id: UUID4 | None
    is_granted: bool
    is_revoked: bool


class CustomerBenefitGrantDiscord(CustomerBenefitGrantBase):
    benefit: BenefitDiscordSubscriber
    properties: BenefitGrantDiscordProperties


class CustomerBenefitGrantGitHubRepository(CustomerBenefitGrantBase):
    benefit: BenefitGitHubRepositorySubscriber
    properties: BenefitGrantGitHubRepositoryProperties


class CustomerBenefitGrantDownloadables(CustomerBenefitGrantBase):
    benefit: BenefitDownloadablesSubscriber
    properties: BenefitGrantDownloadablesProperties


class CustomerBenefitGrantLicenseKeys(CustomerBenefitGrantBase):
    benefit: BenefitLicenseKeysSubscriber
    properties: BenefitGrantLicenseKeysProperties


class CustomerBenefitGrantAds(CustomerBenefitGrantBase):
    benefit: BenefitAdsSubscriber
    properties: BenefitGrantAdsProperties


class CustomerBenefitGrantCustom(CustomerBenefitGrantBase):
    benefit: BenefitCustomSubscriber
    properties: BenefitGrantCustomProperties


CustomerBenefitGrant = Annotated[
    CustomerBenefitGrantDiscord
    | CustomerBenefitGrantGitHubRepository
    | CustomerBenefitGrantDownloadables
    | CustomerBenefitGrantLicenseKeys
    | CustomerBenefitGrantAds
    | CustomerBenefitGrantCustom,
    SetSchemaReference("CustomerBenefitGrant"),
    MergeJSONSchema({"title": "CustomerBenefitGrant"}),
    ClassName("CustomerBenefitGrant"),
]
CustomerBenefitGrantAdapter: TypeAdapter[CustomerBenefitGrant] = TypeAdapter(
    CustomerBenefitGrant
)


class CustomerBenefitGrantUpdateBase(Schema):
    benefit_type: BenefitType


class CustomerBenefitGrantDiscordPropertiesUpdate(TypedDict):
    account_id: str


class CustomerBenefitGrantDiscordUpdate(CustomerBenefitGrantUpdateBase):
    benefit_type: Literal[BenefitType.discord]
    properties: CustomerBenefitGrantDiscordPropertiesUpdate

    def get_oauth_platform(self) -> Literal[CustomerOAuthPlatform.discord]:
        return CustomerOAuthPlatform.discord


class CustomerBenefitGrantGitHubRepositoryPropertiesUpdate(TypedDict):
    account_id: str


class CustomerBenefitGrantGitHubRepositoryUpdate(CustomerBenefitGrantUpdateBase):
    benefit_type: Literal[BenefitType.github_repository]
    properties: CustomerBenefitGrantGitHubRepositoryPropertiesUpdate

    def get_oauth_platform(self) -> Literal[CustomerOAuthPlatform.github]:
        return CustomerOAuthPlatform.github


class CustomerBenefitGrantDownloadablesUpdate(CustomerBenefitGrantUpdateBase):
    benefit_type: Literal[BenefitType.downloadables]


class CustomerBenefitGrantLicenseKeysUpdate(CustomerBenefitGrantUpdateBase):
    benefit_type: Literal[BenefitType.license_keys]


class CustomerBenefitGrantAdsUpdate(CustomerBenefitGrantUpdateBase):
    benefit_type: Literal[BenefitType.ads]


class CustomerBenefitGrantCustomUpdate(CustomerBenefitGrantUpdateBase):
    benefit_type: Literal[BenefitType.custom]


CustomerBenefitGrantUpdate = Annotated[
    CustomerBenefitGrantDiscordUpdate
    | CustomerBenefitGrantGitHubRepositoryUpdate
    | CustomerBenefitGrantDownloadablesUpdate
    | CustomerBenefitGrantLicenseKeysUpdate
    | CustomerBenefitGrantAdsUpdate
    | CustomerBenefitGrantCustomUpdate,
    SetSchemaReference("CustomerBenefitGrantUpdate"),
    MergeJSONSchema({"title": "CustomerBenefitGrantUpdate"}),
    Discriminator("benefit_type"),
]
