from pydantic import UUID4, Field

from polar.kit.address import Address
from polar.kit.schemas import EmailStrDNS, IDSchema, Schema, TimestampedSchema
from polar.kit.tax import TaxID
from polar.organization.schemas import OrganizationID


class CustomerCreate(Schema):
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


class CustomerUpdate(Schema):
    email: EmailStrDNS | None = None
    name: str | None = None
    billing_address: Address | None = None
    tax_id: TaxID | None = None


class Customer(IDSchema, TimestampedSchema):
    email: str
    email_verified: bool
    name: str | None
    billing_address: Address | None
    tax_id: TaxID | None
    organization_id: UUID4
