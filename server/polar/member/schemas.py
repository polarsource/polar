from typing import Annotated, Literal

from annotated_types import MaxLen
from fastapi import Path
from pydantic import UUID4, Field

from polar.kit.email import EmailStrDNS
from polar.kit.schemas import (
    EmptyStrToNoneValidator,
    IDSchema,
    Schema,
    TimestampedSchema,
)
from polar.models.member import MemberRole

ExternalMemberID = Annotated[str, Path(description="The member external ID.")]

_external_id_description = (
    "The ID of the member in your system. This must be unique within the customer. "
)
_external_id_example = "usr_1337"
_email_description = "The email address of the member."
_email_example = "member@example.com"
_name_description = "The name of the member."
_name_example = "Jane Doe"

MemberNameInput = Annotated[
    str,
    MaxLen(256),
    Field(description=_name_description, examples=[_name_example]),
    EmptyStrToNoneValidator,
]


class MemberOwnerCreate(Schema):
    """Schema for creating an owner member during customer creation."""

    email: EmailStrDNS = Field(
        description=_email_description, examples=[_email_example]
    )
    name: MemberNameInput | None = None
    external_id: Annotated[str | None, EmptyStrToNoneValidator] = Field(
        default=None,
        description=_external_id_description,
        examples=[_external_id_example],
    )


class MemberCreate(Schema):
    """Schema for creating a new member."""

    customer_id: UUID4 = Field(
        description="The ID of the customer this member belongs to."
    )
    email: EmailStrDNS = Field(
        description=_email_description, examples=[_email_example]
    )
    name: MemberNameInput | None = None
    external_id: Annotated[str | None, EmptyStrToNoneValidator] = Field(
        default=None,
        description=_external_id_description,
        examples=[_external_id_example],
    )
    # Owner is excluded: ownership is established via `MemberOwnerCreate` on
    # customer creation, or transferred via the update endpoint.
    role: Literal[MemberRole.member, MemberRole.billing_manager] = Field(
        default=MemberRole.member,
        description=(
            "The role of the member within the customer. To assign or transfer "
            "ownership, use the member update endpoint."
        ),
        examples=[MemberRole.member],
    )


class MemberUpdate(Schema):
    """Schema for updating a member."""

    name: MemberNameInput | None = None
    role: MemberRole | None = Field(
        default=None,
        description="The role of the member within the customer.",
        examples=[MemberRole.member],
    )


class MemberBase(TimestampedSchema, IDSchema):
    """Base schema for member responses."""

    id: UUID4 = Field(description="The ID of the member.")
    customer_id: UUID4 = Field(
        description="The ID of the customer this member belongs to."
    )
    email: str = Field(description=_email_description, examples=[_email_example])
    name: str | None = Field(description=_name_description, examples=[_name_example])
    external_id: str | None = Field(
        description=_external_id_description, examples=[_external_id_example]
    )
    role: MemberRole = Field(
        description="The role of the member within the customer.",
        examples=[MemberRole.owner],
    )


class Member(MemberBase):
    """A member of a customer."""

    pass
