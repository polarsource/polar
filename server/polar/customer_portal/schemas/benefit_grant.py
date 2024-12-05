from datetime import datetime
from typing import Annotated

from pydantic import UUID4, TypeAdapter

from polar.benefit.schemas import (
    BenefitAdsSubscriber,
    BenefitCustomSubscriber,
    BenefitDiscordSubscriber,
    BenefitDownloadablesSubscriber,
    BenefitGitHubRepositorySubscriber,
    BenefitLicenseKeysSubscriber,
    BenefitSubscriber,
)
from polar.kit.schemas import IDSchema, MergeJSONSchema, TimestampedSchema
from polar.models.benefit_grant import (
    BenefitGrantAdsProperties,
    BenefitGrantCustomProperties,
    BenefitGrantDiscordProperties,
    BenefitGrantDownloadablesProperties,
    BenefitGrantGitHubRepositoryProperties,
    BenefitGrantLicenseKeysProperties,
)


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


class BenefitGrantCustomer(BenefitGrantBase):
    benefit: BenefitCustomSubscriber
    properties: BenefitGrantCustomProperties


BenefitGrant = Annotated[
    BenefitGrantDiscord
    | BenefitGrantGitHubRepository
    | BenefitGrantDownloadables
    | BenefitGrantLicenseKeys
    | BenefitGrantAds
    | BenefitGrantCustomer,
    MergeJSONSchema({"title": "BenefitGrant"}),
]
BenefitGrantAdapter: TypeAdapter[BenefitGrant] = TypeAdapter(BenefitGrant)
