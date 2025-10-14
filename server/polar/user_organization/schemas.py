from datetime import datetime
from uuid import UUID

from pydantic import AliasPath, EmailStr, Field

from polar.kit.schemas import Schema


class OrganizationMember(Schema):
    user_id: UUID = Field(description="The user ID of the organization member")
    created_at: datetime = Field(
        description="The time the OrganizationMember was creatd."
    )
    email: str = Field(validation_alias=AliasPath("user", "email"))
    avatar_url: str | None = Field(validation_alias=AliasPath("user", "avatar_url"))
    is_admin: bool = Field(
        default=False, description="Whether the member is the organization admin"
    )


class OrganizationMemberInvite(Schema):
    email: EmailStr = Field(description="Email address of the user to invite")
