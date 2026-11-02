from datetime import datetime
from typing import Annotated, Literal, TypedDict

from pydantic import UUID4, Discriminator, EmailStr, Field, TypeAdapter

from polar.benefit.strategies.custom.properties import BenefitGrantCustomProperties
from polar.benefit.strategies.custom.schemas import BenefitCustomSubscriber
from polar.benefit.strategies.discord.properties import BenefitGrantDiscordProperties
from polar.benefit.strategies.discord.schemas import BenefitDiscordSubscriber
from polar.benefit.strategies.downloadables.properties import (
    BenefitGrantDownloadablesProperties,
)
from polar.benefit.strategies.downloadables.schemas import (
    BenefitDownloadablesSubscriber,
)
from polar.benefit.strategies.feature_flag.properties import (
    BenefitGrantFeatureFlagProperties,
)
from polar.benefit.strategies.feature_flag.schemas import (
    BenefitFeatureFlagSubscriber,
)
from polar.benefit.strategies.github_repository.properties import (
    BenefitGrantGitHubRepositoryProperties,
)
from polar.benefit.strategies.github_repository.schemas import (
    BenefitGitHubRepositorySubscriber,
)
from polar.benefit.strategies.license_keys.properties import (
    BenefitGrantLicenseKeysProperties,
)
from polar.benefit.strategies.license_keys.schemas import BenefitLicenseKeysSubscriber
from polar.benefit.strategies.meter_credit.properties import (
    BenefitGrantMeterCreditProperties,
)
from polar.benefit.strategies.meter_credit.schemas import BenefitMeterCreditSubscriber
from polar.benefit.strategies.slack_shared_channel.properties import (
    BenefitGrantSlackSharedChannelProperties,
)
from polar.benefit.strategies.slack_shared_channel.schemas import (
    BenefitSlackSharedChannelSubscriber,
)
from polar.kit.schemas import (
    ClassName,
    IDSchema,
    MergeJSONSchema,
    MultipleQueryFilter,
    Schema,
    SetSchemaReference,
    TimestampedSchema,
)
from polar.kit.versioning import QuerySchema
from polar.models.benefit import BenefitType
from polar.models.benefit_grant import BenefitGrantError
from polar.models.customer import CustomerOAuthPlatform
from polar.order.schemas import OrderID
from polar.subscription.schemas import SubscriptionID

from .customer import CustomerPortalCustomer, CustomerPortalOAuthAccount


class CustomerBenefitGrantBase(IDSchema, TimestampedSchema):
    granted_at: datetime | None
    revoked_at: datetime | None
    customer_id: UUID4
    member_id: UUID4 | None = None
    benefit_id: UUID4
    subscription_id: UUID4 | None
    order_id: UUID4 | None
    is_granted: bool
    is_revoked: bool
    error: BenefitGrantError | None = None


class CustomerBenefitGrantMember(IDSchema):
    oauth_accounts: dict[str, CustomerPortalOAuthAccount]


class CustomerBenefitGrantDiscord(CustomerBenefitGrantBase):
    customer: CustomerPortalCustomer
    member: CustomerBenefitGrantMember | None = None
    benefit: BenefitDiscordSubscriber
    properties: BenefitGrantDiscordProperties


class CustomerBenefitGrantGitHubRepository(CustomerBenefitGrantBase):
    customer: CustomerPortalCustomer
    member: CustomerBenefitGrantMember | None = None
    benefit: BenefitGitHubRepositorySubscriber
    properties: BenefitGrantGitHubRepositoryProperties


class CustomerBenefitGrantDownloadables(CustomerBenefitGrantBase):
    customer: CustomerPortalCustomer
    benefit: BenefitDownloadablesSubscriber
    properties: BenefitGrantDownloadablesProperties


class CustomerBenefitGrantLicenseKeys(CustomerBenefitGrantBase):
    customer: CustomerPortalCustomer
    benefit: BenefitLicenseKeysSubscriber
    properties: BenefitGrantLicenseKeysProperties


class CustomerBenefitGrantCustom(CustomerBenefitGrantBase):
    customer: CustomerPortalCustomer
    benefit: BenefitCustomSubscriber
    properties: BenefitGrantCustomProperties


class CustomerBenefitGrantMeterCredit(CustomerBenefitGrantBase):
    customer: CustomerPortalCustomer
    benefit: BenefitMeterCreditSubscriber
    properties: BenefitGrantMeterCreditProperties


class CustomerBenefitGrantFeatureFlag(CustomerBenefitGrantBase):
    customer: CustomerPortalCustomer
    benefit: BenefitFeatureFlagSubscriber
    properties: BenefitGrantFeatureFlagProperties


class CustomerBenefitGrantSlackSharedChannel(CustomerBenefitGrantBase):
    customer: CustomerPortalCustomer
    benefit: BenefitSlackSharedChannelSubscriber
    properties: BenefitGrantSlackSharedChannelProperties


CustomerBenefitGrant = Annotated[
    CustomerBenefitGrantDiscord
    | CustomerBenefitGrantGitHubRepository
    | CustomerBenefitGrantDownloadables
    | CustomerBenefitGrantLicenseKeys
    | CustomerBenefitGrantCustom
    | CustomerBenefitGrantMeterCredit
    | CustomerBenefitGrantFeatureFlag
    | CustomerBenefitGrantSlackSharedChannel,
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
    account_id: str | None


class CustomerBenefitGrantDiscordUpdate(CustomerBenefitGrantUpdateBase):
    benefit_type: Literal[BenefitType.discord]
    properties: CustomerBenefitGrantDiscordPropertiesUpdate

    def get_oauth_platform(self) -> Literal[CustomerOAuthPlatform.discord]:
        return CustomerOAuthPlatform.discord


class CustomerBenefitGrantGitHubRepositoryPropertiesUpdate(TypedDict):
    account_id: str | None


class CustomerBenefitGrantGitHubRepositoryUpdate(CustomerBenefitGrantUpdateBase):
    benefit_type: Literal[BenefitType.github_repository]
    properties: CustomerBenefitGrantGitHubRepositoryPropertiesUpdate

    def get_oauth_platform(self) -> Literal[CustomerOAuthPlatform.github]:
        return CustomerOAuthPlatform.github


class CustomerBenefitGrantDownloadablesUpdate(CustomerBenefitGrantUpdateBase):
    benefit_type: Literal[BenefitType.downloadables]


class CustomerBenefitGrantLicenseKeysUpdate(CustomerBenefitGrantUpdateBase):
    benefit_type: Literal[BenefitType.license_keys]


class CustomerBenefitGrantCustomUpdate(CustomerBenefitGrantUpdateBase):
    benefit_type: Literal[BenefitType.custom]


class CustomerBenefitGrantMeterCreditUpdate(CustomerBenefitGrantUpdateBase):
    benefit_type: Literal[BenefitType.meter_credit]


class CustomerBenefitGrantFeatureFlagUpdate(CustomerBenefitGrantUpdateBase):
    benefit_type: Literal[BenefitType.feature_flag]


class CustomerBenefitGrantSlackSharedChannelPropertiesUpdate(TypedDict):
    invited_email: EmailStr


class CustomerBenefitGrantSlackSharedChannelUpdate(CustomerBenefitGrantUpdateBase):
    benefit_type: Literal[BenefitType.slack_shared_channel]
    properties: CustomerBenefitGrantSlackSharedChannelPropertiesUpdate


CustomerBenefitGrantUpdate = Annotated[
    CustomerBenefitGrantDiscordUpdate
    | CustomerBenefitGrantGitHubRepositoryUpdate
    | CustomerBenefitGrantDownloadablesUpdate
    | CustomerBenefitGrantLicenseKeysUpdate
    | CustomerBenefitGrantCustomUpdate
    | CustomerBenefitGrantMeterCreditUpdate
    | CustomerBenefitGrantFeatureFlagUpdate
    | CustomerBenefitGrantSlackSharedChannelUpdate,
    SetSchemaReference("CustomerBenefitGrantUpdate"),
    MergeJSONSchema({"title": "CustomerBenefitGrantUpdate"}),
    Discriminator("benefit_type"),
]


class CustomerPortalBenefitGrantListParams(QuerySchema):
    query: str | None = Field(None, description="Filter by benefit description.")
    type: MultipleQueryFilter[BenefitType] | None = Field(
        None, title="BenefitType Filter", description="Filter by benefit type."
    )
    benefit_id: MultipleQueryFilter[UUID4] | None = Field(
        None, title="BenefitID Filter", description="Filter by benefit ID."
    )
    checkout_id: MultipleQueryFilter[UUID4] | None = Field(
        None, title="CheckoutID Filter", description="Filter by checkout ID."
    )
    order_id: MultipleQueryFilter[OrderID] | None = Field(
        None, title="OrderID Filter", description="Filter by order ID."
    )
    subscription_id: MultipleQueryFilter[SubscriptionID] | None = Field(
        None, title="SubscriptionID Filter", description="Filter by subscription ID."
    )
    member_id: MultipleQueryFilter[UUID4] | None = Field(
        None, title="MemberID Filter", description="Filter by member ID."
    )
