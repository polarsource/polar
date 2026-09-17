from typing import Literal, Self

from pydantic import Field, computed_field, field_validator, model_validator

from polar.config import settings
from polar.kit import jwt
from polar.kit.schemas import Schema
from polar.models.benefit import BenefitType

from ..base.schemas import (
    BenefitBase,
    BenefitCreateBase,
    BenefitSubscriberBase,
    BenefitUpdateBase,
)


class BenefitDiscordProperties(Schema):
    """
    Properties for a benefit of type `discord`.
    """

    guild_id: str = Field(..., description="The ID of the Discord server.")
    role_id: str = Field(..., description="The ID of the Discord role to grant.")
    kick_member: bool = Field(
        ...,
        description="Whether to kick the member from the Discord server on revocation.",
    )

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

    guild_id: str | None = Field(
        default=None, description="The ID of the Discord server."
    )
    guild_token: str | None = Field(
        default=None, deprecated="Use `guild_id`.", exclude=True
    )
    role_id: str = Field(..., description="The ID of the Discord role to grant.")
    kick_member: bool = Field(
        ...,
        description="Whether to kick the member from the Discord server on revocation.",
    )

    @field_validator("guild_token")
    @classmethod
    def validate_guild_token(cls, v: str | None) -> str | None:
        if v is None:
            return None
        try:
            guild_token_data = jwt.decode(
                token=v, secret=settings.SECRET, type="discord_guild_token"
            )
            return guild_token_data["guild_id"]
        except (KeyError, jwt.DecodeError, jwt.ExpiredSignatureError) as e:
            raise ValueError(
                "Invalid token. Please authenticate your Discord server again."
            ) from e

    @model_validator(mode="after")
    def resolve_guild_id(self) -> Self:
        if self.guild_id is None:
            if self.guild_token is None:
                raise ValueError("guild_id is required.")
            self.guild_id = self.guild_token
        return self


class BenefitDiscordSubscriberProperties(Schema):
    """
    Properties available to subscribers for a benefit of type `discord`.
    """

    guild_id: str = Field(..., description="The ID of the Discord server.")


class BenefitDiscordCreate(BenefitCreateBase):
    type: Literal[BenefitType.discord]
    properties: BenefitDiscordCreateProperties


class BenefitDiscordUpdate(BenefitUpdateBase):
    type: Literal[BenefitType.discord]
    properties: BenefitDiscordCreateProperties | None = None


class BenefitDiscord(BenefitBase):
    """
    A benefit of type `discord`.

    Use it to automatically invite your backers to a Discord server.
    """

    type: Literal[BenefitType.discord]
    properties: BenefitDiscordProperties


class BenefitDiscordSubscriber(BenefitSubscriberBase):
    type: Literal[BenefitType.discord]
    properties: BenefitDiscordSubscriberProperties
