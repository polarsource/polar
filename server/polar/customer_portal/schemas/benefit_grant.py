from datetime import datetime
from typing import Annotated, Literal, TypedDict

from pydantic import UUID4, Discriminator, TypeAdapter

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
from polar.kit.schemas import (
    ClassName,
    IDSchema,
    MergeJSONSchema,
    Schema,
    SetSchemaReference,
    TimestampedSchema,
)
from polar.models.benefit import BenefitType
from polar.models.customer import CustomerOAuthPlatform

from .customer import CustomerPortalCustomer


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


class CustomerBenefitGrantDiscord(CustomerBenefitGrantBase):
    customer: CustomerPortalCustomer
    benefit: BenefitDiscordSubscriber
    properties: BenefitGrantDiscordProperties


class CustomerBenefitGrantGitHubRepository(CustomerBenefitGrantBase):
    customer: CustomerPortalCustomer
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


CustomerBenefitGrant = Annotated[
    CustomerBenefitGrantDiscord
    | CustomerBenefitGrantGitHubRepository
    | CustomerBenefitGrantDownloadables
    | CustomerBenefitGrantLicenseKeys
    | CustomerBenefitGrantCustom
    | CustomerBenefitGrantMeterCredit,
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


CustomerBenefitGrantUpdate = Annotated[
    CustomerBenefitGrantDiscordUpdate
    | CustomerBenefitGrantGitHubRepositoryUpdate
    | CustomerBenefitGrantDownloadablesUpdate
    | CustomerBenefitGrantLicenseKeysUpdate
    | CustomerBenefitGrantCustomUpdate
    | CustomerBenefitGrantMeterCreditUpdate,
    SetSchemaReference("CustomerBenefitGrantUpdate"),
    MergeJSONSchema({"title": "CustomerBenefitGrantUpdate"}),
    Discriminator("benefit_type"),
]
