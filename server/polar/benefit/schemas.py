from datetime import datetime
from typing import Literal

from pydantic import UUID4, Field, computed_field, field_validator

from polar.config import settings
from polar.kit import jwt
from polar.kit.schemas import Schema, TimestampedSchema
from polar.models.benefit import BenefitType

BENEFIT_DESCRIPTION_MIN_LENGTH = 3
BENEFIT_DESCRIPTION_MAX_LENGTH = 42

# BenefitProperties


class BenefitProperties(Schema): ...


## Custom


class BenefitCustomProperties(Schema):
    note: str | None = None


class BenefitCustomSubscriberProperties(Schema):
    note: str | None = None


## Articles


class BenefitArticlesProperties(Schema):
    paid_articles: bool


class BenefitArticlesSubscriberProperties(Schema):
    paid_articles: bool


## Ads


class BenefitAdsProperties(Schema):
    image_height: int = 400
    image_width: int = 400


## Discord


class BenefitDiscordProperties(Schema):
    guild_id: str
    role_id: str

    @computed_field  # type: ignore[misc]
    @property
    def guild_token(self) -> str:
        return jwt.encode(
            data={"guild_id": self.guild_id},
            secret=settings.SECRET,
            type="discord_guild_token",
        )


class BenefitDiscordCreateProperties(Schema):
    guild_token: str = Field(serialization_alias="guild_id")
    role_id: str

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
    guild_id: str


## GitHub Repository


class BenefitGitHubRepositoryCreateProperties(Schema):
    # For benefits created before 2014-13-15 repository_id will be set
    # no new benefits of this type are allowed to be created
    repository_id: UUID4 | None = None
    # For benefits created after 2014-13-15 both repository_owner and repository_name will be set
    repository_owner: str | None = None
    repository_name: str | None = None
    permission: Literal["pull", "triage", "push", "maintain", "admin"]


class BenefitGitHubRepositoryProperties(Schema):
    # Is set to None for all benefits created after 2024-03-15
    repository_id: UUID4 | None = None
    repository_owner: str
    repository_name: str
    permission: Literal["pull", "triage", "push", "maintain", "admin"]


class BenefitGitHubRepositorySubscriberProperties(Schema):
    repository_owner: str
    repository_name: str


# BenefitCreate


class BenefitCreateBase(Schema):
    description: str = Field(
        ...,
        min_length=BENEFIT_DESCRIPTION_MIN_LENGTH,
        max_length=BENEFIT_DESCRIPTION_MAX_LENGTH,
    )
    organization_id: UUID4 | None = None


class BenefitCustomCreate(BenefitCreateBase):
    type: Literal[BenefitType.custom]
    is_tax_applicable: bool
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


BenefitCreate = (
    BenefitCustomCreate
    | BenefitAdsCreate
    | BenefitDiscordCreate
    | BenefitGitHubRepositoryCreate
)


# BenefitUpdate


class BenefitUpdateBase(Schema):
    description: str | None = Field(
        None,
        min_length=BENEFIT_DESCRIPTION_MIN_LENGTH,
        max_length=BENEFIT_DESCRIPTION_MAX_LENGTH,
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


BenefitUpdate = (
    BenefitArticlesUpdate
    | BenefitAdsUpdate
    | BenefitCustomUpdate
    | BenefitDiscordUpdate
    | BenefitGitHubRepositoryUpdate
)


# Benefit


class BenefitBase(TimestampedSchema):
    id: UUID4
    type: BenefitType
    description: str
    selectable: bool
    deletable: bool
    organization_id: UUID4


class BenefitCustom(BenefitBase):
    type: Literal[BenefitType.custom]
    properties: BenefitCustomProperties
    is_tax_applicable: bool


class BenefitArticles(BenefitBase):
    type: Literal[BenefitType.articles]
    properties: BenefitArticlesProperties


class BenefitAds(BenefitBase):
    type: Literal[BenefitType.ads]
    properties: BenefitAdsProperties


class BenefitDiscord(BenefitBase):
    type: Literal[BenefitType.discord]
    properties: BenefitDiscordProperties


class BenefitGitHubRepository(BenefitBase):
    type: Literal[BenefitType.github_repository]
    properties: BenefitGitHubRepositoryProperties


Benefit = (
    BenefitArticles
    | BenefitAds
    | BenefitCustom
    | BenefitDiscord
    | BenefitGitHubRepository
)

benefit_schema_map: dict[BenefitType, type[Benefit]] = {
    BenefitType.discord: BenefitDiscord,
    BenefitType.articles: BenefitArticles,
    BenefitType.ads: BenefitAds,
    BenefitType.custom: BenefitCustom,
    BenefitType.github_repository: BenefitGitHubRepository,
}

# BenefitSubscriber


class BenefitCustomSubscriber(BenefitBase):
    type: Literal[BenefitType.custom]
    properties: BenefitCustomSubscriberProperties


class BenefitArticlesSubscriber(BenefitBase):
    type: Literal[BenefitType.articles]
    properties: BenefitArticlesSubscriberProperties


class BenefitAdsSubscriber(BenefitBase):
    type: Literal[BenefitType.ads]
    properties: BenefitAdsProperties


class BenefitDiscordSubscriber(BenefitBase):
    type: Literal[BenefitType.discord]
    properties: BenefitDiscordSubscriberProperties


class BenefitGitHubRepositorySubscriber(BenefitBase):
    type: Literal[BenefitType.github_repository]
    properties: BenefitGitHubRepositorySubscriberProperties


# Properties that are available to subscribers only
BenefitSubscriber = (
    BenefitArticlesSubscriber
    | BenefitAdsSubscriber
    | BenefitDiscordSubscriber
    | BenefitCustomSubscriber
    | BenefitGitHubRepositorySubscriber
)

# Properties that are public (included in Subscription Tier endpoints)
BenefitPublic = BenefitBase | BenefitArticles


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
    subscription_id: UUID4 = Field(
        description="The ID of the subscription that granted this benefit."
    )
    user_id: UUID4 = Field(description="The ID of the user concerned by this grant.")
    benefit_id: UUID4 = Field(
        description="The ID of the benefit concerned by this grant."
    )
