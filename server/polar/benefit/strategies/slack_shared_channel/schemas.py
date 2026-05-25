from typing import Annotated, Literal

from pydantic import Field, StringConstraints
from pydantic.json_schema import SkipJsonSchema

from polar.kit.schemas import Schema
from polar.models.benefit import BenefitType

from ..base.schemas import (
    BenefitBase,
    BenefitCreateBase,
    BenefitSubscriberBase,
    BenefitUpdateBase,
)

ChannelNameTemplate = Annotated[str, StringConstraints(min_length=1, max_length=80)]
WelcomeMessage = Annotated[str | None, StringConstraints(max_length=4000)]


class BenefitSlackSharedChannelProperties(Schema):
    channel_name_template: ChannelNameTemplate = Field(
        description=(
            "Template for the channel name. Supports placeholders: "
            "{customer_name}, {customer_email_local}, and {metadata.<key>} "
            "for any value stored in customer user metadata."
        ),
    )
    private: bool = Field(
        default=True,
        description="Create the channel as private (recommended).",
    )
    welcome_message: WelcomeMessage = Field(
        default=None,
        description="Optional message posted to the channel right after creation.",
    )
    archive_on_revoke: bool = Field(
        default=True,
        description="Archive the channel when the benefit is revoked.",
    )
    team_invitees: list[str] = Field(
        default_factory=list,
        description=(
            "Slack user IDs from the merchant workspace to invite to every "
            "channel created for this benefit."
        ),
    )


class BenefitSlackSharedChannelCreateProperties(Schema):
    channel_name_template: ChannelNameTemplate
    private: bool = True
    welcome_message: WelcomeMessage = None
    archive_on_revoke: bool = True
    team_invitees: list[str] = Field(default_factory=list)


class BenefitSlackSharedChannelCreate(BenefitCreateBase):
    type: Literal[BenefitType.slack_shared_channel]
    properties: BenefitSlackSharedChannelCreateProperties


class BenefitSlackSharedChannelUpdate(BenefitUpdateBase):
    type: Literal[BenefitType.slack_shared_channel]
    properties: BenefitSlackSharedChannelCreateProperties | None = None


class BenefitSlackSharedChannel(BenefitBase):
    """A benefit that provisions a Slack Connect channel per customer."""

    type: Literal[BenefitType.slack_shared_channel]
    properties: BenefitSlackSharedChannelProperties
    is_tax_applicable: SkipJsonSchema[bool] = Field(deprecated=True)


class BenefitSlackSharedChannelSubscriberProperties(Schema):
    """Subscriber-facing properties — nothing sensitive to expose."""


class BenefitSlackSharedChannelSubscriber(BenefitSubscriberBase):
    type: Literal[BenefitType.slack_shared_channel]
    properties: BenefitSlackSharedChannelSubscriberProperties
