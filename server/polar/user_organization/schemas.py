from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import AliasPath, Field

from polar.kit.email import EmailStrDNS
from polar.kit.schemas import Schema
from polar.models.user_organization import (
    OrganizationNotificationSettings,
    OrganizationRole,
)


class OrganizationMember(Schema):
    user_id: UUID = Field(
        validation_alias=AliasPath("user", "id"),
        description="The ID of the user.",
    )
    created_at: datetime = Field(
        description="The time the OrganizationMember was created."
    )
    email: str = Field(validation_alias=AliasPath("user", "email"))
    avatar_url: str | None = Field(validation_alias=AliasPath("user", "avatar_url"))
    role: OrganizationRole = Field(
        description="The user's role on the organization.",
    )


class OrganizationMemberInvite(Schema):
    email: EmailStrDNS = Field(description="Email address of the user to invite")


class OrganizationMemberRoleUpdate(Schema):
    role: Literal[OrganizationRole.admin, OrganizationRole.member] = Field(
        description=(
            "The role to assign. `owner` is rejected — ownership transfers "
            "go through a separate flow."
        ),
    )


class UserOrganizationNotificationSettings(Schema):
    notification_settings: OrganizationNotificationSettings = Field(
        description="The authenticated user's notification preferences for this organization.",
    )


class UserOrganizationNotificationSettingsUpdate(Schema):
    notification_settings: OrganizationNotificationSettings = Field(
        description="The notification settings to store for the current user on this organization.",
    )
