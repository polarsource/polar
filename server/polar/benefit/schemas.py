from datetime import datetime
from typing import Annotated, Any, Literal

from annotated_types import Len
from pydantic import (
    UUID4,
    Discriminator,
    Field,
    TypeAdapter,
    computed_field,
    field_validator,
    model_validator,
)

from polar.config import settings
from polar.customer.schemas import Customer
from polar.kit import jwt
from polar.kit.schemas import (
    ClassName,
    IDSchema,
    MergeJSONSchema,
    Schema,
    SelectorWidget,
    SetSchemaReference,
    TimestampedSchema,
)
from polar.models.benefit import BenefitType
from polar.models.benefit_grant import (
    BenefitGrantProperties,
)
from polar.organization.schemas import Organization, OrganizationID

BENEFIT_DESCRIPTION_MIN_LENGTH = 3
BENEFIT_DESCRIPTION_MAX_LENGTH = 42

BenefitID = Annotated[
    UUID4,
    MergeJSONSchema({"description": "The benefit ID."}),
    SelectorWidget("/v1/benefits", "Benefit", "description"),
]

# BenefitProperties


class BenefitProperties(Schema): ...


## Custom

Note = Annotated[
    str | None,
    Field(
        description=(
            "Private note to be shared with customers who have this benefit granted."
        ),
    ),
]


class BenefitCustomProperties(Schema):
    """
    Properties for a benefit of type `custom`.
    """

    note: Note | None


class BenefitCustomCreateProperties(Schema):
    """
    Properties for creating a benefit of type `custom`.
    """

    note: Note | None = None


class BenefitCustomSubscriberProperties(Schema):
    """
    Properties available to subscribers for a benefit of type `custom`.
    """

    note: Note | None


## Discord


class BenefitDiscordProperties(Schema):
    """
    Properties for a benefit of type `discord`.
    """

    guild_id: str = Field(..., description="The ID of the Discord server.")
    role_id: str = Field(..., description="The ID of the Discord role to grant.")

    @computed_field  # type: ignore[prop-decorator]
    @property
    def guild_token(self) -> str:
        return jwt.encode(
            data={"guild_id": self.guild_id},
            secret=settings.SECRET,
            type="discord_guild_token",
        )


class BenefitDiscordCreateProperties(Schema):
    """
    Properties to create a benefit of type `discord`.
    """

    guild_token: str = Field(serialization_alias="guild_id")
    role_id: str = Field(..., description="The ID of the Discord role to grant.")

    @field_validator("guild_token")
    @classmethod
    def validate_guild_token(cls, v: str) -> str:
        try:
            guild_token_data = jwt.decode(
                token=v, secret=settings.SECRET, type="discord_guild_token"
            )
            return guild_token_data["guild_id"]
        except (KeyError, jwt.DecodeError, jwt.ExpiredSignatureError) as e:
            raise ValueError(
                "Invalid token. Please authenticate your Discord server again."
            ) from e


class BenefitDiscordSubscriberProperties(Schema):
    """
    Properties available to subscribers for a benefit of type `discord`.
    """

    guild_id: str = Field(..., description="The ID of the Discord server.")


## GitHub Repository

Permission = Annotated[
    Literal["pull", "triage", "push", "maintain", "admin"],
    Field(
        description=(
            "The permission level to grant. "
            "Read more about roles and their permissions on "
            "[GitHub documentation](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/repository-roles-for-an-organization#permissions-for-each-role)."
        )
    ),
]
RepositoryOwner = Annotated[
    str,
    Field(description="The owner of the repository.", examples=["polarsource"]),
]
RepositoryName = Annotated[
    str,
    Field(description="The name of the repository.", examples=["private_repo"]),
]


class BenefitGitHubRepositoryCreateProperties(Schema):
    """
    Properties to create a benefit of type `github_repository`.
    """

    repository_owner: str = Field(
        description="The owner of the repository.", examples=["polarsource"]
    )
    repository_name: str = Field(
        description="The name of the repository.", examples=["private_repo"]
    )
    permission: Permission


class BenefitGitHubRepositoryProperties(Schema):
    """
    Properties for a benefit of type `github_repository`.
    """

    repository_owner: RepositoryOwner
    repository_name: RepositoryName
    permission: Permission
    repository_id: UUID4 | None = Field(None, deprecated=True)


class BenefitGitHubRepositorySubscriberProperties(Schema):
    """
    Properties available to subscribers for a benefit of type `github_repository`.
    """

    repository_owner: RepositoryOwner
    repository_name: RepositoryName


## Downloads


class BenefitDownloadablesCreateProperties(Schema):
    archived: dict[UUID4, bool] = {}
    files: Annotated[list[UUID4], Len(min_length=1)]


class BenefitDownloadablesProperties(Schema):
    archived: dict[UUID4, bool]
    files: list[UUID4]


def get_active_file_ids(properties: BenefitDownloadablesProperties) -> list[UUID4]:
    active = []
    archived_files = properties.archived
    for file_id in properties.files:
        archived = archived_files.get(file_id, False)
        if not archived:
            active.append(file_id)

    return active


class BenefitDownloadablesSubscriberProperties(Schema):
    active_files: list[UUID4]

    @model_validator(mode="before")
    @classmethod
    def assign_active_files(cls, data: dict[str, Any]) -> dict[str, Any]:
        if "files" not in data:
            return data

        schema = BenefitDownloadablesProperties(**data)
        actives = get_active_file_ids(schema)
        return dict(active_files=actives)


## License Keys


class BenefitLicenseKeyExpirationProperties(Schema):
    ttl: int = Field(gt=0)
    timeframe: Literal["year", "month", "day"]


class BenefitLicenseKeyActivationProperties(Schema):
    limit: int = Field(gt=0, le=1000)
    enable_customer_admin: bool


class BenefitLicenseKeysCreateProperties(Schema):
    prefix: str | None = None
    expires: BenefitLicenseKeyExpirationProperties | None = None
    activations: BenefitLicenseKeyActivationProperties | None = None
    limit_usage: int | None = Field(gt=0, default=None)


class BenefitLicenseKeysProperties(Schema):
    prefix: str | None
    expires: BenefitLicenseKeyExpirationProperties | None
    activations: BenefitLicenseKeyActivationProperties | None
    limit_usage: int | None


class BenefitLicenseKeysSubscriberProperties(Schema):
    prefix: str | None
    expires: BenefitLicenseKeyExpirationProperties | None
    activations: BenefitLicenseKeyActivationProperties | None
    limit_usage: int | None


# BenefitCreate


class BenefitCreateBase(Schema):
    type: BenefitType
    description: str = Field(
        ...,
        min_length=BENEFIT_DESCRIPTION_MIN_LENGTH,
        max_length=BENEFIT_DESCRIPTION_MAX_LENGTH,
        description=(
            "The description of the benefit. "
            "Will be displayed on products having this benefit."
        ),
    )
    organization_id: OrganizationID | None = Field(
        None,
        description=(
            "The ID of the organization owning the benefit. "
            "**Required unless you use an organization token.**"
        ),
    )


class BenefitCustomCreate(BenefitCreateBase):
    """
    Schema to create a benefit of type `custom`.
    """

    type: Literal[BenefitType.custom]
    properties: BenefitCustomCreateProperties


class BenefitDiscordCreate(BenefitCreateBase):
    type: Literal[BenefitType.discord]
    properties: BenefitDiscordCreateProperties


class BenefitGitHubRepositoryCreate(BenefitCreateBase):
    type: Literal[BenefitType.github_repository]
    properties: BenefitGitHubRepositoryCreateProperties


class BenefitDownloadablesCreate(BenefitCreateBase):
    type: Literal[BenefitType.downloadables]
    properties: BenefitDownloadablesCreateProperties


class BenefitLicenseKeysCreate(BenefitCreateBase):
    type: Literal[BenefitType.license_keys]
    properties: BenefitLicenseKeysCreateProperties


BenefitCreate = Annotated[
    BenefitCustomCreate
    | BenefitDiscordCreate
    | BenefitGitHubRepositoryCreate
    | BenefitDownloadablesCreate
    | BenefitLicenseKeysCreate,
    Discriminator("type"),
    SetSchemaReference("BenefitCreate"),
]


# BenefitUpdate


class BenefitUpdateBase(Schema):
    description: str | None = Field(
        None,
        min_length=BENEFIT_DESCRIPTION_MIN_LENGTH,
        max_length=BENEFIT_DESCRIPTION_MAX_LENGTH,
        description=(
            "The description of the benefit. "
            "Will be displayed on products having this benefit."
        ),
    )


class BenefitCustomUpdate(BenefitUpdateBase):
    type: Literal[BenefitType.custom]
    properties: BenefitCustomProperties | None = None


class BenefitDiscordUpdate(BenefitUpdateBase):
    type: Literal[BenefitType.discord]
    properties: BenefitDiscordCreateProperties | None = None


class BenefitGitHubRepositoryUpdate(BenefitUpdateBase):
    type: Literal[BenefitType.github_repository]
    properties: BenefitGitHubRepositoryCreateProperties | None = None


class BenefitDownloadablesUpdate(BenefitUpdateBase):
    type: Literal[BenefitType.downloadables]
    properties: BenefitDownloadablesCreateProperties | None = None


class BenefitLicenseKeysUpdate(BenefitUpdateBase):
    type: Literal[BenefitType.license_keys]
    properties: BenefitLicenseKeysCreateProperties | None = None


BenefitUpdate = (
    BenefitCustomUpdate
    | BenefitDiscordUpdate
    | BenefitGitHubRepositoryUpdate
    | BenefitDownloadablesUpdate
    | BenefitLicenseKeysUpdate
)


# Benefit


class BenefitBase(IDSchema, TimestampedSchema):
    id: UUID4 = Field(..., description="The ID of the benefit.")
    type: BenefitType = Field(..., description="The type of the benefit.")
    description: str = Field(..., description="The description of the benefit.")
    selectable: bool = Field(
        ..., description="Whether the benefit is selectable when creating a product."
    )
    deletable: bool = Field(..., description="Whether the benefit is deletable.")
    organization_id: UUID4 = Field(
        ..., description="The ID of the organization owning the benefit."
    )


class BenefitCustom(BenefitBase):
    """
    A benefit of type `custom`.

    Use it to grant any kind of benefit that doesn't fit in the other types.
    """

    type: Literal[BenefitType.custom]
    properties: BenefitCustomProperties
    is_tax_applicable: bool = Field(deprecated=True)


class BenefitDiscord(BenefitBase):
    """
    A benefit of type `discord`.

    Use it to automatically invite your backers to a Discord server.
    """

    type: Literal[BenefitType.discord]
    properties: BenefitDiscordProperties


class BenefitGitHubRepository(BenefitBase):
    """
    A benefit of type `github_repository`.

    Use it to automatically invite your backers to a private GitHub repository.
    """

    type: Literal[BenefitType.github_repository]
    properties: BenefitGitHubRepositoryProperties


class BenefitDownloadables(BenefitBase):
    type: Literal[BenefitType.downloadables]
    properties: BenefitDownloadablesProperties


class BenefitLicenseKeys(BenefitBase):
    type: Literal[BenefitType.license_keys]
    properties: BenefitLicenseKeysProperties


Benefit = Annotated[
    BenefitCustom
    | BenefitDiscord
    | BenefitGitHubRepository
    | BenefitDownloadables
    | BenefitLicenseKeys,
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
}


class BenefitGrantBase(IDSchema, TimestampedSchema):
    """
    A grant of a benefit to a customer.
    """

    id: UUID4 = Field(description="The ID of the grant.")
    granted_at: datetime | None = Field(
        None,
        description=(
            "The timestamp when the benefit was granted. "
            "If `None`, the benefit is not granted."
        ),
    )
    is_granted: bool = Field(description="Whether the benefit is granted.")
    revoked_at: datetime | None = Field(
        None,
        description=(
            "The timestamp when the benefit was revoked. "
            "If `None`, the benefit is not revoked."
        ),
    )
    is_revoked: bool = Field(description="Whether the benefit is revoked.")
    subscription_id: UUID4 | None = Field(
        description="The ID of the subscription that granted this benefit.",
    )
    order_id: UUID4 | None = Field(
        description="The ID of the order that granted this benefit."
    )
    customer_id: UUID4 = Field(
        description="The ID of the customer concerned by this grant."
    )
    user_id: UUID4 = Field(
        validation_alias="customer_id", deprecated="Use `customer_id`."
    )
    benefit_id: UUID4 = Field(
        description="The ID of the benefit concerned by this grant."
    )


class BenefitGrant(BenefitGrantBase):
    customer: Customer
    properties: BenefitGrantProperties


class BenefitGrantWebhook(BenefitGrant):
    benefit: Benefit
    previous_properties: BenefitGrantProperties | None = None


# BenefitSubscriber


class BenefitSubscriberBase(BenefitBase):
    organization: Organization


class BenefitCustomSubscriber(BenefitSubscriberBase):
    type: Literal[BenefitType.custom]
    properties: BenefitCustomSubscriberProperties


class BenefitDiscordSubscriber(BenefitSubscriberBase):
    type: Literal[BenefitType.discord]
    properties: BenefitDiscordSubscriberProperties


class BenefitGitHubRepositorySubscriber(BenefitSubscriberBase):
    type: Literal[BenefitType.github_repository]
    properties: BenefitGitHubRepositorySubscriberProperties


class BenefitDownloadablesSubscriber(BenefitSubscriberBase):
    type: Literal[BenefitType.downloadables]
    properties: BenefitDownloadablesSubscriberProperties


class BenefitLicenseKeysSubscriber(BenefitSubscriberBase):
    type: Literal[BenefitType.license_keys]
    properties: BenefitLicenseKeysSubscriberProperties


# Properties that are available to subscribers only
BenefitSubscriber = Annotated[
    BenefitDiscordSubscriber
    | BenefitCustomSubscriber
    | BenefitGitHubRepositorySubscriber
    | BenefitDownloadablesSubscriber
    | BenefitLicenseKeysSubscriber,
    Discriminator("type"),
]

BenefitSubscriberAdapter = TypeAdapter[BenefitSubscriber](BenefitSubscriber)

# Properties that are public (when embedding products benefits in storefront and checkout)
BenefitPublic = BenefitBase
