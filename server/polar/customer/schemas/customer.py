import hashlib
from datetime import datetime
from typing import Annotated

from annotated_types import MaxLen
from fastapi import Path
from pydantic import UUID4, Field, computed_field

from polar.config import settings
from polar.kit.address import Address, AddressInput
from polar.kit.email import EmailStrDNS
from polar.kit.metadata import (
    MetadataInputMixin,
    MetadataOutputMixin,
)
from polar.kit.schemas import (
    CUSTOMER_ID_EXAMPLE,
    ORGANIZATION_ID_EXAMPLE,
    EmptyStrToNoneValidator,
    IDSchema,
    Schema,
    TimestampedSchema,
)
from polar.kit.tax import TaxID
from polar.member import Member, OwnerCreate
from polar.organization.schemas import OrganizationID

CustomerID = Annotated[UUID4, Path(description="The customer ID.")]
ExternalCustomerID = Annotated[str, Path(description="The customer external ID.")]

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

CustomerNameInput = Annotated[
    str,
    MaxLen(256),
    Field(description=_name_description, examples=[_name_example]),
    EmptyStrToNoneValidator,
]


class CustomerCreate(MetadataInputMixin, Schema):
    external_id: Annotated[str | None, EmptyStrToNoneValidator] = Field(
        default=None,
        description=_external_id_description,
        examples=[_external_id_example],
    )
    email: EmailStrDNS = Field(
        description=_email_description, examples=[_email_example]
    )
    name: CustomerNameInput | None = None
    billing_address: AddressInput | None = None
    tax_id: TaxID | None = None
    organization_id: OrganizationID | None = Field(
        default=None,
        description=(
            "The ID of the organization owning the customer. "
            "**Required unless you use an organization token.**"
        ),
    )
    owner: OwnerCreate | None = Field(
        default=None,
        description=(
            "Optional owner member to create with the customer. "
            "If not provided, an owner member will be automatically created "
            "using the customer's email and name."
        ),
    )


class CustomerUpdateBase(MetadataInputMixin, Schema):
    email: EmailStrDNS | None = Field(
        default=None, description=_email_description, examples=[_email_example]
    )
    name: CustomerNameInput | None = None
    billing_address: AddressInput | None = None
    tax_id: TaxID | None = None


class CustomerUpdate(CustomerUpdateBase):
    external_id: Annotated[str | None, EmptyStrToNoneValidator] = Field(
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

    @computed_field(examples=["https://www.gravatar.com/avatar/xxx?d=404"])
    def avatar_url(self) -> str:
        domain = self.email.split("@")[-1].lower()

        if (
            not settings.LOGO_DEV_PUBLISHABLE_KEY
            or domain in settings.PERSONAL_EMAIL_DOMAINS
        ):
            email_hash = hashlib.sha256(self.email.lower().encode()).hexdigest()
            return f"https://www.gravatar.com/avatar/{email_hash}?d=404"

        return f"https://img.logo.dev/{domain}?size=64&retina=true&token={settings.LOGO_DEV_PUBLISHABLE_KEY}&fallback=404"


class Customer(CustomerBase):
    """A customer in an organization."""


class CustomerWithMembers(Customer):
    """A customer in an organization with their members loaded."""

    members: list[Member] = Field(
        default_factory=list,
        description="List of members belonging to this customer.",
    )
