from datetime import datetime
from typing import Annotated, Literal

from pydantic import (
    UUID4,
    Discriminator,
    Field,
    TypeAdapter,
    computed_field,
    field_validator,
)

from polar.config import settings
from polar.kit import jwt
from polar.kit.schemas import Schema, TimestampedSchema
from polar.models.benefit import BenefitType

BENEFIT_DESCRIPTION_MIN_LENGTH = 3
BENEFIT_DESCRIPTION_MAX_LENGTH = 42

# BenefitProperties


class BenefitProperties(Schema): ...


## Custom

Note = Annotated[
    str | None,
    Field(
        description=(
            "Private note to be shared with users who have this benefit granted."
        ),
    ),
]


class BenefitCustomProperties(Schema):
    """
    Properties for a benefit of type `custom`.
    """

    note: Note = None


class BenefitCustomSubscriberProperties(Schema):
    """
    Properties available to subscribers for a benefit of type `custom`.
    """

    note: Note = None


## Articles

PaidArticles = Annotated[
    bool, Field(description="Whether the user can access paid articles.")
]


class BenefitArticlesProperties(Schema):
    """
    Properties for a benefit of type `articles`.
    """

    paid_articles: PaidArticles


class BenefitArticlesSubscriberProperties(Schema):
    """
    Properties available to subscribers for a benefit of type `articles`.
    """

    paid_articles: PaidArticles


## Ads


class BenefitAdsProperties(Schema):
    """
    Properties for a benefit of type `ads`.
    """

    image_height: int = Field(400, description="The height of the displayed ad.")
    image_width: int = Field(400, description="The width of the displayed ad.")


## Discord


class BenefitDiscordProperties(Schema):
    """
    Properties for a benefit of type `discord`.
    """

    guild_id: str = Field(..., description="The ID of the Discord server.")
    role_id: str = Field(..., description="The ID of the Discord role to grant.")

    @computed_field  # type: ignore[misc]
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

    # For benefits created before 2014-13-15 repository_id will be set
    # no new benefits of this type are allowed to be created
    repository_id: UUID4 | None = None
    # For benefits created after 2014-13-15 both repository_owner and repository_name will be set
    repository_owner: str | None = Field(
        None, description="The owner of the repository.", examples=["polarsource"]
    )
    repository_name: str | None = Field(
        None, description="The name of the repository.", examples=["private_repo"]
    )
    permission: Permission


class BenefitGitHubRepositoryProperties(Schema):
    """
    Properties for a benefit of type `github_repository`.
    """

    # Is set to None for all benefits created after 2024-03-15
    repository_id: UUID4 | None = None
    repository_owner: RepositoryOwner
    repository_name: RepositoryName
    permission: Permission


class BenefitGitHubRepositorySubscriberProperties(Schema):
    """
    Properties available to subscribers for a benefit of type `github_repository`.
    """

    repository_owner: RepositoryOwner
    repository_name: RepositoryName


## Downloads


class BenefitDownloadablesCreateProperties(Schema):
    files: list[UUID4]


class BenefitDownloadablesProperties(Schema):
    files: list[UUID4]


class BenefitDownloadablesSubscriberProperties(Schema):
    files: list[UUID4]


# BenefitCreate

IsTaxApplicable = Annotated[bool, Field(description="Whether the benefit is taxable.")]


class BenefitCreateBase(Schema):
    description: str = Field(
        ...,
        min_length=BENEFIT_DESCRIPTION_MIN_LENGTH,
        max_length=BENEFIT_DESCRIPTION_MAX_LENGTH,
        description=(
            "The description of the benefit. "
            "Will be displayed on products having this benefit."
        ),
    )
    organization_id: UUID4 | None = Field(
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
    is_tax_applicable: IsTaxApplicable
    properties: BenefitCustomProperties


class BenefitAdsCreate(BenefitCreateBase):
    type: Literal[BenefitType.ads]
    properties: BenefitAdsProperties


class BenefitDiscordCreate(BenefitCreateBase):
    type: Literal[BenefitType.discord]
    properties: BenefitDiscordCreateProperties


class BenefitGitHubRepositoryCreate(BenefitCreateBase):
    type: Literal[BenefitType.github_repository]
    properties: BenefitGitHubRepositoryCreateProperties


class BenefitDownloadablesCreate(BenefitCreateBase):
    type: Literal[BenefitType.downloadables]
    properties: BenefitDownloadablesCreateProperties


BenefitCreate = (
    BenefitCustomCreate
    | BenefitAdsCreate
    | BenefitDiscordCreate
    | BenefitGitHubRepositoryCreate
    | BenefitDownloadablesCreate
)


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


class BenefitArticlesUpdate(BenefitUpdateBase):
    # Don't allow to update properties, as both Free and Premium posts
    # are pre-created by us and shouldn't change
    type: Literal[BenefitType.articles]


class BenefitAdsUpdate(BenefitUpdateBase):
    type: Literal[BenefitType.ads]
    properties: BenefitAdsProperties | None = None


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


BenefitUpdate = (
    BenefitArticlesUpdate
    | BenefitAdsUpdate
    | BenefitCustomUpdate
    | BenefitDiscordUpdate
    | BenefitGitHubRepositoryUpdate
    | BenefitDownloadablesUpdate
)


# Benefit


class BenefitBase(TimestampedSchema):
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
    is_tax_applicable: IsTaxApplicable


class BenefitArticles(BenefitBase):
    """
    A benefit of type `articles`.

    Use it to grant access to posts.
    """

    type: Literal[BenefitType.articles]
    properties: BenefitArticlesProperties


class BenefitAds(BenefitBase):
    """
    A benefit of type `ads`.

    Use it so your backers can display ads on your README, website, etc.
    """

    type: Literal[BenefitType.ads]
    properties: BenefitAdsProperties


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


Benefit = (
    BenefitArticles
    | BenefitAds
    | BenefitCustom
    | BenefitDiscord
    | BenefitGitHubRepository
    | BenefitDownloadables
)

benefit_schema_map: dict[BenefitType, type[Benefit]] = {
    BenefitType.discord: BenefitDiscord,
    BenefitType.articles: BenefitArticles,
    BenefitType.ads: BenefitAds,
    BenefitType.custom: BenefitCustom,
    BenefitType.github_repository: BenefitGitHubRepository,
    BenefitType.downloadables: BenefitDownloadables,
}


class BenefitGrantProperties(Schema):
    """
    Properties for a benefit grant.
    """


class BenefitGrant(TimestampedSchema):
    """
    A grant of a benefit to a user.
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
    properties: BenefitGrantProperties = Field(
        description="The properties of the grant."
    )
    subscription_id: UUID4 | None = Field(
        default=None,
        description="The ID of the subscription that granted this benefit.",
    )
    order_id: UUID4 | None = Field(
        default=None, description="The ID of the order that granted this benefit."
    )
    user_id: UUID4 = Field(description="The ID of the user concerned by this grant.")
    benefit_id: UUID4 = Field(
        description="The ID of the benefit concerned by this grant."
    )


# BenefitSubscriber


class BenefitSubscriberBase(BenefitBase):
    grants: list[BenefitGrant]


class BenefitCustomSubscriber(BenefitSubscriberBase):
    type: Literal[BenefitType.custom]
    properties: BenefitCustomSubscriberProperties


class BenefitArticlesSubscriber(BenefitBase):
    type: Literal[BenefitType.articles]
    properties: BenefitArticlesSubscriberProperties


class BenefitGrantAdsProperties(BenefitGrantProperties):
    advertisement_campaign_id: UUID4 | None = Field(
        None,
        description="The ID of the enabled advertisement campaign for this benefit grant.",
    )


class BenefitGrantAds(BenefitGrant):
    properties: BenefitGrantAdsProperties


class BenefitAdsSubscriber(BenefitBase):
    type: Literal[BenefitType.ads]
    properties: BenefitAdsProperties
    grants: list[BenefitGrantAds]


class BenefitDiscordSubscriber(BenefitBase):
    type: Literal[BenefitType.discord]
    properties: BenefitDiscordSubscriberProperties


class BenefitGitHubRepositorySubscriber(BenefitBase):
    type: Literal[BenefitType.github_repository]
    properties: BenefitGitHubRepositorySubscriberProperties


class BenefitDownloadablesSubscriber(BenefitBase):
    type: Literal[BenefitType.downloadables]
    properties: BenefitDownloadablesSubscriberProperties


# Properties that are available to subscribers only
BenefitSubscriber = Annotated[
    BenefitArticlesSubscriber
    | BenefitAdsSubscriber
    | BenefitDiscordSubscriber
    | BenefitCustomSubscriber
    | BenefitGitHubRepositorySubscriber
    | BenefitDownloadablesSubscriber,
    Discriminator("type"),
]

BenefitSubscriberAdapter = TypeAdapter[BenefitSubscriber](BenefitSubscriber)

# Properties that are public (included in Product endpoints)
BenefitPublic = BenefitBase | BenefitArticles
