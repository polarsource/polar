from datetime import datetime

from pydantic import UUID4, Field

from polar.customer.schemas import Customer
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema


class CustomerSessionCreate(Schema):
    """
    Schema for creating a customer session.
    """

    customer_id: UUID4 = Field(
        description="ID of the customer to create a session for."
    )


class CustomerSession(IDSchema, TimestampedSchema):
    """
    A customer session that can be used to authenticate as a customer.
    """

    token: str = Field(validation_alias="raw_token")
    expires_at: datetime
    customer_portal_url: str
    customer_id: UUID4
    customer: Customer
