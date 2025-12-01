from datetime import datetime

from pydantic import AliasPath, Field

from polar.kit.email import EmailStrDNS
from polar.kit.schemas import Schema


class OrganizationMember(Schema):
    created_at: datetime = Field(
        description="The time the OrganizationMember was creatd."
    )
    email: str = Field(validation_alias=AliasPath("user", "email"))
    avatar_url: str | None = Field(validation_alias=AliasPath("user", "avatar_url"))


class OrganizationMemberInvite(Schema):
    email: EmailStrDNS = Field(description="Email address of the user to invite")
