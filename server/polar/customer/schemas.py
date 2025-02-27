import hashlib
from typing import Annotated

from fastapi import Path
from pydantic import UUID4, Field, computed_field

from polar.kit.address import Address
from polar.kit.metadata import (
    MetadataInputMixin,
    MetadataOutputMixin,
    OptionalMetadataInputMixin,
)
from polar.kit.schemas import (
    EmailStrDNS,
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
_email_description = (
    "The email address of the customer. This must be unique within the organization."
)


class CustomerCreate(MetadataInputMixin, Schema):
    external_id: str | None = Field(default=None, description=_external_id_description)
    email: EmailStrDNS = Field(description=_email_description)
    name: str | None = None
    billing_address: Address | None = None
    tax_id: TaxID | None = None
    organization_id: OrganizationID | None = Field(
        default=None,
        description=(
            "The ID of the organization owning the customer. "
            "**Required unless you use an organization token.**"
        ),
    )


class CustomerUpdate(OptionalMetadataInputMixin, Schema):
    external_id: str | None = Field(default=None, description=_external_id_description)
    email: EmailStrDNS | None = Field(default=None, description=_email_description)
    name: str | None = None
    billing_address: Address | None = None
    tax_id: TaxID | None = None


class CustomerBase(MetadataOutputMixin, IDSchema, TimestampedSchema):
    external_id: str | None = Field(description=_external_id_description)
    email: str = Field(description=_email_description)
    email_verified: bool = Field(
        description=(
            "Whether the customer email address is verified. "
            "The address is automatically verified when the customer accesses "
            "the customer portal using their email address."
        )
    )
    name: str | None
    billing_address: Address | None
    tax_id: TaxID | None
    organization_id: UUID4

    @computed_field
    def avatar_url(self) -> str:
        email_hash = hashlib.sha256(self.email.lower().encode()).hexdigest()
        return f"https://www.gravatar.com/avatar/{email_hash}?d=blank"


class Customer(CustomerBase):
    """A customer in an organization."""
