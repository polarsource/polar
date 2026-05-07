from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import AliasPath, Field, computed_field

from polar.kit.email import EmailStrDNS
from polar.kit.schemas import Schema
from polar.models.user_organization import OrganizationRole


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

    @computed_field(  # type: ignore[prop-decorator]
        description=(
            "Whether the user has admin capability on the organization. "
            "Derived from `role`: true for `owner` or `admin`. "
            "Kept as a transitional alias; prefer reading `role` directly."
        ),
    )
    @property
    def is_admin(self) -> bool:
        return self.role in {OrganizationRole.owner, OrganizationRole.admin}


class OrganizationMemberInvite(Schema):
    email: EmailStrDNS = Field(description="Email address of the user to invite")


class OrganizationMemberRoleUpdate(Schema):
    role: Literal[OrganizationRole.admin, OrganizationRole.member] = Field(
        description=(
            "The role to assign. `owner` is rejected — ownership transfers "
            "go through a separate flow."
        ),
    )
