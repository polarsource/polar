from typing import Literal, Self
from uuid import UUID

from pydantic import Field, model_validator

from polar.enums import AccountType
from polar.kit.address import Address
from polar.kit.schemas import Schema
from polar.models.account import Account as AccountModel
from polar.organization.schemas import Organization
from polar.user.schemas import UserBase


class AccountCreateForOrganization(Schema):
    organization_id: UUID = Field(
        description="Organization ID to create or get account for"
    )

    account_type: Literal[AccountType.stripe]
    country: str = Field(
        description="Two letter uppercase country code", min_length=2, max_length=2
    )

    @model_validator(mode="after")
    def validate_country(self) -> Self:
        if self.country.upper() != self.country:
            raise ValueError("country must be uppercase")
        return self


class Account(Schema):
    id: UUID
    account_type: AccountType
    status: AccountModel.Status
    stripe_id: str | None
    open_collective_slug: str | None
    is_details_submitted: bool
    is_charges_enabled: bool
    is_payouts_enabled: bool
    country: str = Field(min_length=2, max_length=2)

    billing_name: str | None
    billing_address: Address | None
    billing_additional_info: str | None
    billing_notes: str | None

    users: list[UserBase]
    organizations: list[Organization]


class AccountUpdate(Schema):
    billing_name: str | None = Field(
        default=None,
        description="Billing name that should appear on the reverse invoice.",
    )
    billing_address: Address | None = Field(
        default=None,
        description="Billing address that should appear on the reverse invoice.",
    )
    billing_additional_info: str | None = Field(
        default=None,
        description="Additional information that should appear on the reverse invoice.",
    )
    billing_notes: str | None = Field(
        default=None,
        description="Notes that should appear on the reverse invoice.",
    )


class AccountLink(Schema):
    url: str
