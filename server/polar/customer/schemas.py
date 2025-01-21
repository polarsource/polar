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


class CustomerCreate(MetadataInputMixin, Schema):
    email: EmailStrDNS
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
    email: EmailStrDNS | None = None
    name: str | None = None
    billing_address: Address | None = None
    tax_id: TaxID | None = None


class CustomerBase(MetadataOutputMixin, IDSchema, TimestampedSchema):
    email: str
    email_verified: bool
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
