from datetime import datetime
from typing import Annotated

from pydantic import UUID4, Field, HttpUrl

from polar.customer.schemas.customer import Customer
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.member.schemas import Member


class MemberSessionCreate(Schema):
    """
    Schema for creating a member session using a member ID.
    """

    member_id: UUID4 = Field(description="ID of the member to create a session for.")
    return_url: Annotated[
        HttpUrl | None,
        Field(
            description=(
                "When set, a back button will be shown in the customer portal "
                "to return to this URL."
            ),
            examples=["https://example.com/account"],
        ),
    ] = None


class MemberSession(IDSchema, TimestampedSchema):
    """
    A member session that can be used to authenticate as a member in the customer portal.
    """

    token: str = Field(validation_alias="raw_token")
    expires_at: datetime
    return_url: str | None
    member_portal_url: str
    member_id: UUID4
    member: Member
    customer_id: UUID4
    customer: Customer
