from pydantic import AliasPath, Field

from polar.kit.schemas import Schema


class OrganizationMember(Schema):
    email: str = Field(validation_alias=AliasPath("user", "email"))
    avatar_url: str | None = Field(validation_alias=AliasPath("user", "avatar_url"))
