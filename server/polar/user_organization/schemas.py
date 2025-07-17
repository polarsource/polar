from pydantic import AliasPath, EmailStr, Field

from polar.kit.schemas import Schema


class OrganizationMember(Schema):
    email: str = Field(validation_alias=AliasPath("user", "email"))
    avatar_url: str | None = Field(validation_alias=AliasPath("user", "avatar_url"))


class OrganizationMemberInvite(Schema):
    email: EmailStr = Field(description="Email address of the user to invite")
