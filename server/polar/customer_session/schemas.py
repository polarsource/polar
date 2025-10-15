from datetime import datetime
from typing import Annotated

from pydantic import UUID4, Field, HttpUrl
from pydantic.aliases import AliasChoices

from polar.customer.schemas.customer import Customer
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema


class CustomerSessionCreateBase(Schema):
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


class CustomerSessionCustomerIDCreate(CustomerSessionCreateBase):
    """
    Schema for creating a customer session using a customer ID.
    """

    customer_id: UUID4 = Field(
        description="ID of the customer to create a session for."
    )


class CustomerSessionCustomerExternalIDCreate(CustomerSessionCreateBase):
    """
    Schema for creating a customer session using an external customer ID.
    """

    external_customer_id: str = Field(
        description="External ID of the customer to create a session for.",
        validation_alias=AliasChoices("external_customer_id", "customer_external_id"),
    )


CustomerSessionCreate = (
    CustomerSessionCustomerIDCreate | CustomerSessionCustomerExternalIDCreate
)


class CustomerSession(IDSchema, TimestampedSchema):
    """
    A customer session that can be used to authenticate as a customer.
    """

    token: str = Field(validation_alias="raw_token")
    expires_at: datetime
    return_url: str | None
    customer_portal_url: str
    customer_id: UUID4
    customer: Customer
