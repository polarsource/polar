from pydantic import Field

from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.models.member import MemberRole


class CustomerPortalMember(IDSchema, TimestampedSchema):
    """A member of the customer's team as seen in the customer portal."""

    email: str = Field(description="The email address of the member.")
    name: str | None = Field(description="The name of the member.")
    role: MemberRole = Field(description="The role of the member within the team.")


class CustomerPortalMemberUpdate(Schema):
    """Schema for updating a member's role in the customer portal."""

    role: MemberRole = Field(
        description="The new role for the member.",
        examples=[MemberRole.billing_manager, MemberRole.member],
    )
