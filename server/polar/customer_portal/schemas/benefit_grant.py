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
    BenefitSubscriber,
)
from polar.kit.schemas import IDSchema, MergeJSONSchema, Schema, TimestampedSchema
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


class BenefitGrantBase(IDSchema, TimestampedSchema):
    granted_at: datetime | None
    revoked_at: datetime | None
    customer_id: UUID4
    benefit_id: UUID4
    subscription_id: UUID4 | None
    order_id: UUID4 | None
    is_granted: bool
    is_revoked: bool


BenefitCustomer = Annotated[
    BenefitSubscriber,
    MergeJSONSchema({"title": "BenefitCustomer"}),
]


class BenefitGrantDiscord(BenefitGrantBase):
    benefit: BenefitDiscordSubscriber
    properties: BenefitGrantDiscordProperties


class BenefitGrantGitHubRepository(BenefitGrantBase):
    benefit: BenefitGitHubRepositorySubscriber
    properties: BenefitGrantGitHubRepositoryProperties


class BenefitGrantDownloadables(BenefitGrantBase):
    benefit: BenefitDownloadablesSubscriber
    properties: BenefitGrantDownloadablesProperties


class BenefitGrantLicenseKeys(BenefitGrantBase):
    benefit: BenefitLicenseKeysSubscriber
    properties: BenefitGrantLicenseKeysProperties


class BenefitGrantAds(BenefitGrantBase):
    benefit: BenefitAdsSubscriber
    properties: BenefitGrantAdsProperties


class BenefitGrantCustom(BenefitGrantBase):
    benefit: BenefitCustomSubscriber
    properties: BenefitGrantCustomProperties


BenefitGrant = Annotated[
    BenefitGrantDiscord
    | BenefitGrantGitHubRepository
    | BenefitGrantDownloadables
    | BenefitGrantLicenseKeys
    | BenefitGrantAds
    | BenefitGrantCustom,
    MergeJSONSchema({"title": "BenefitGrant"}),
]
BenefitGrantAdapter: TypeAdapter[BenefitGrant] = TypeAdapter(BenefitGrant)


class BenefitGrantUpdateBase(Schema):
    benefit_type: BenefitType


class BenefitGrantDiscordPropertiesUpdate(TypedDict):
    account_id: str


class BenefitGrantDiscordUpdate(BenefitGrantUpdateBase):
    properties: BenefitGrantDiscordPropertiesUpdate

    def get_oauth_platform(self) -> Literal[CustomerOAuthPlatform.discord]:
        return CustomerOAuthPlatform.discord


class BenefitGrantGitHubRepositoryPropertiesUpdate(TypedDict):
    account_id: str


class BenefitGrantGitHubRepositoryUpdate(BenefitGrantUpdateBase):
    properties: BenefitGrantGitHubRepositoryPropertiesUpdate

    def get_oauth_platform(self) -> Literal[CustomerOAuthPlatform.github]:
        return CustomerOAuthPlatform.github


class BenefitGrantDownloadablesUpdate(BenefitGrantUpdateBase):
    pass


class BenefitGrantLicenseKeysUpdate(BenefitGrantUpdateBase):
    pass


class BenefitGrantAdsUpdate(BenefitGrantUpdateBase):
    pass


class BenefitGrantCustomUpdate(BenefitGrantUpdateBase):
    pass


BenefitGrantUpdate = Annotated[
    BenefitGrantDiscordUpdate
    | BenefitGrantGitHubRepositoryUpdate
    | BenefitGrantDownloadablesUpdate
    | BenefitGrantLicenseKeysUpdate
    | BenefitGrantAdsUpdate
    | BenefitGrantCustomUpdate,
    MergeJSONSchema({"title": "BenefitGrantUpdate"}),
    Discriminator("benefit_type"),
]
