from pydantic import Field

from polar.kit.email import EmailStrDNS
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.models.member import MemberRole


class CustomerPortalMember(IDSchema, TimestampedSchema):
    """A member of the customer's team as seen in the customer portal."""

    email: str = Field(description="The email address of the member.")
    name: str | None = Field(description="The name of the member.")
    role: MemberRole = Field(description="The role of the member within the team.")


class CustomerPortalMemberCreate(Schema):
    """Schema for adding a new member to the customer's team."""

    email: EmailStrDNS = Field(description="The email address of the new member.")
    name: str | None = Field(
        default=None,
        description="The name of the new member (optional).",
    )
    role: MemberRole = Field(
        default=MemberRole.member,
        description="The role for the new member. Defaults to 'member'.",
        examples=[MemberRole.billing_manager, MemberRole.member],
    )


class CustomerPortalMemberUpdate(Schema):
    """Schema for updating a member's role in the customer portal."""

    role: MemberRole | None = Field(
        default=None,
        description="The new role for the member.",
        examples=[MemberRole.billing_manager, MemberRole.member],
    )
