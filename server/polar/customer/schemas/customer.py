import hashlib
from datetime import datetime
from typing import Annotated, Any, Literal

from annotated_types import MaxLen
from fastapi import Path
from pydantic import UUID4, Discriminator, Field, Tag, computed_field, model_validator
from pydantic.aliases import AliasChoices

from polar.config import settings
from polar.kit.address import Address, AddressInput
from polar.kit.email import EmailStrDNS
from polar.kit.locale import Locale
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
    SetSchemaReference,
    TimestampedSchema,
)
from polar.member import MemberOwnerCreate
from polar.models.customer import CustomerType
from polar.organization.schemas import OrganizationID
from polar.tax.tax_id import TaxID

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


# --- Create schemas ---


class CustomerCreateBase(MetadataInputMixin, Schema):
    external_id: Annotated[str | None, EmptyStrToNoneValidator] = Field(
        default=None,
        description=_external_id_description,
        examples=[_external_id_example],
    )
    name: CustomerNameInput | None = None
    billing_address: AddressInput | None = None
    tax_id: Annotated[str | None, EmptyStrToNoneValidator] = None
    locale: Locale | None = None
    organization_id: OrganizationID | None = Field(
        default=None,
        description=(
            "The ID of the organization owning the customer. "
            "**Required unless you use an organization token.**"
        ),
    )
    owner: MemberOwnerCreate | None = Field(
        default=None,
        description=(
            "Optional owner member to create with the customer. "
            "If not provided, an owner member will be automatically created "
            "using the customer's email and name."
        ),
    )


class CustomerIndividualCreate(CustomerCreateBase):
    type: Literal["individual"] = "individual"
    email: EmailStrDNS = Field(
        description=_email_description, examples=[_email_example]
    )


class CustomerTeamCreate(CustomerCreateBase):
    type: Literal["team"]
    email: EmailStrDNS | None = Field(
        default=None,
        description=(
            "The email address of the team customer. "
            "Optional for team customers — if omitted, an owner with an email must be provided."
        ),
        examples=[_email_example],
    )

    @model_validator(mode="after")
    def _require_owner_email_when_no_email(self) -> "CustomerTeamCreate":
        if self.email is None:
            if self.owner is None or self.owner.email is None:
                raise ValueError(
                    "An owner with an email address is required when creating "
                    "a team customer without an email."
                )
        return self


def _customer_create_type(v: Any) -> str:
    """Default to 'individual' for backward compat when type is omitted."""
    if isinstance(v, dict):
        return v.get("type", "individual")
    return getattr(v, "type", "individual")


CustomerCreate = Annotated[
    Annotated[CustomerIndividualCreate, Tag("individual")]
    | Annotated[CustomerTeamCreate, Tag("team")],
    Discriminator(_customer_create_type),
    SetSchemaReference("CustomerCreate"),
]


# --- Update schemas ---


class CustomerUpdateBase(MetadataInputMixin, Schema):
    email: EmailStrDNS | None = Field(
        default=None, description=_email_description, examples=[_email_example]
    )
    name: CustomerNameInput | None = None
    billing_address: AddressInput | None = None
    tax_id: Annotated[str | None, EmptyStrToNoneValidator] = None
    locale: Locale | None = None


class CustomerUpdate(CustomerUpdateBase):
    external_id: Annotated[str | None, EmptyStrToNoneValidator] = Field(
        default=None,
        description=_external_id_description,
        examples=[_external_id_example],
    )
    type: CustomerType | None = Field(
        default=None,
        description=(
            "The customer type. "
            "Can only be upgraded from 'individual' to 'team', never downgraded."
        ),
        examples=["team"],
    )


class CustomerUpdateExternalID(CustomerUpdateBase): ...


# --- Read schemas ---


def _avatar_url_for_email(email: str) -> str:
    domain = email.split("@")[-1].lower()

    if (
        not settings.LOGO_DEV_PUBLISHABLE_KEY
        or domain in settings.PERSONAL_EMAIL_DOMAINS
    ):
        email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
        return f"https://www.gravatar.com/avatar/{email_hash}?d=404"

    return f"https://img.logo.dev/{domain}?size=64&retina=true&token={settings.LOGO_DEV_PUBLISHABLE_KEY}&fallback=404"


class CustomerBase(MetadataOutputMixin, TimestampedSchema, IDSchema):
    id: UUID4 = Field(
        description="The ID of the customer.", examples=[CUSTOMER_ID_EXAMPLE]
    )
    external_id: str | None = Field(
        default=None,
        description=_external_id_description,
        examples=[_external_id_example],
        validation_alias=AliasChoices(
            # From ORM model
            "saved_external_id",
            # From cached state or stored webhook payload
            "external_id",
        ),
    )
    email: str | None = Field(
        default=None, description=_email_description, examples=[_email_example]
    )
    email_verified: bool = Field(
        description=(
            "Whether the customer email address is verified. "
            "The address is automatically verified when the customer accesses "
            "the customer portal using their email address."
        ),
        examples=[True],
    )
    type: CustomerType = Field(
        description=(
            "The type of customer: 'individual' for single users, "
            "'team' for customers with multiple members."
        ),
        examples=["individual"],
    )
    name: str | None = Field(description=_name_description, examples=[_name_example])
    billing_address: Address | None
    tax_id: TaxID | None
    locale: str | None = None
    organization_id: UUID4 = Field(
        description="The ID of the organization owning the customer.",
        examples=[ORGANIZATION_ID_EXAMPLE],
    )

    deleted_at: datetime | None = Field(
        description="Timestamp for when the customer was soft deleted."
    )

    @property
    def display_email(self) -> str:
        return self.email or self.name or "Team Customer"

    @computed_field(examples=["https://www.gravatar.com/avatar/xxx?d=404"])  # type: ignore[prop-decorator]
    @property
    def avatar_url(self) -> str:
        if self.email is not None:
            return _avatar_url_for_email(self.email)
        identifier = self.name or str(self.id)
        email_hash = hashlib.sha256(identifier.lower().encode()).hexdigest()
        return f"https://www.gravatar.com/avatar/{email_hash}?d=404"


class CustomerIndividual(CustomerBase):
    """A customer in an organization."""

    type: Literal[CustomerType.individual] = Field(
        default=CustomerType.individual,
        description="The type of customer.",
        examples=["individual"],
    )
    email: str = Field(description=_email_description, examples=[_email_example])


class CustomerTeam(CustomerBase):
    """A team customer in an organization."""

    type: Literal[CustomerType.team] = Field(
        description="The type of customer. Team customers can have multiple members.",
        examples=["team"],
    )


CustomerResponse = Annotated[
    CustomerIndividual | CustomerTeam,
    Discriminator("type"),
    SetSchemaReference("Customer"),
]
