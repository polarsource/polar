from datetime import datetime
from uuid import UUID

from pydantic import AliasPath, Field

from polar.kit.email import EmailStrDNS
from polar.kit.schemas import Schema


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
    is_admin: bool = Field(
        default=False,
        description="Whether the user is an admin of the organization.",
    )


class OrganizationMemberInvite(Schema):
    email: EmailStrDNS = Field(description="Email address of the user to invite")
