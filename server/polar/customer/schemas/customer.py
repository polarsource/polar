import hashlib
from datetime import datetime
from typing import Annotated

from fastapi import Path
from pydantic import UUID4, Field, computed_field

from polar.kit.address import Address
from polar.kit.email import EmailStrDNS
from polar.kit.metadata import (
    MetadataInputMixin,
    MetadataOutputMixin,
)
from polar.kit.schemas import (
    CUSTOMER_ID_EXAMPLE,
    ORGANIZATION_ID_EXAMPLE,
    IDSchema,
    Schema,
    TimestampedSchema,
)
from polar.kit.tax import TaxID
from polar.organization.schemas import OrganizationID

CustomerID = Annotated[UUID4, Path(description="The customer ID.")]
CustomerExternalID = Annotated[str, Path(description="The customer external ID.")]

_external_id_description = (
    "The ID of the customer in your system. "
    "This must be unique within the organization. "
    "Once set, it can't be updated."
)
_external_id_example = "usr_1337"
_email_description = (
    "The email address of the customer. This must be unique within the organization."
)
_email_example = "customer@example.com"
_name_description = "The name of the customer."
_name_example = "John Doe"


class CustomerCreate(MetadataInputMixin, Schema):
    external_id: str | None = Field(
        default=None,
        description=_external_id_description,
        examples=[_external_id_example],
    )
    email: EmailStrDNS = Field(
        description=_email_description, examples=[_email_example]
    )
    name: str | None = Field(
        default=None, description=_name_description, examples=[_name_example]
    )
    billing_address: Address | None = None
    tax_id: TaxID | None = None
    organization_id: OrganizationID | None = Field(
        default=None,
        description=(
            "The ID of the organization owning the customer. "
            "**Required unless you use an organization token.**"
        ),
    )


class CustomerUpdateBase(MetadataInputMixin, Schema):
    email: EmailStrDNS | None = Field(
        default=None, description=_email_description, examples=[_email_example]
    )
    name: str | None = Field(
        default=None, description=_name_description, examples=[_name_example]
    )
    billing_address: Address | None = None
    tax_id: TaxID | None = None


class CustomerUpdate(CustomerUpdateBase):
    external_id: str | None = Field(
        default=None,
        description=_external_id_description,
        examples=[_external_id_example],
    )


class CustomerUpdateExternalID(CustomerUpdateBase): ...


class CustomerBase(MetadataOutputMixin, TimestampedSchema, IDSchema):
    id: UUID4 = Field(
        description="The ID of the customer.", examples=[CUSTOMER_ID_EXAMPLE]
    )
    external_id: str | None = Field(
        description=_external_id_description, examples=[_external_id_example]
    )
    email: str = Field(description=_email_description, examples=[_email_example])
    email_verified: bool = Field(
        description=(
            "Whether the customer email address is verified. "
            "The address is automatically verified when the customer accesses "
            "the customer portal using their email address."
        ),
        examples=[True],
    )
    name: str | None = Field(description=_name_description, examples=[_name_example])
    billing_address: Address | None
    tax_id: TaxID | None
    organization_id: UUID4 = Field(
        description="The ID of the organization owning the customer.",
        examples=[ORGANIZATION_ID_EXAMPLE],
    )

    deleted_at: datetime | None = Field(
        description="Timestamp for when the customer was soft deleted."
    )

    @computed_field(examples=["https://www.gravatar.com/avatar/xxx?d=blank"])
    def avatar_url(self) -> str:
        email_hash = hashlib.sha256(self.email.lower().encode()).hexdigest()
        return f"https://www.gravatar.com/avatar/{email_hash}?d=blank"


class Customer(CustomerBase):
    """A customer in an organization."""
