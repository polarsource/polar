from enum import Enum
from typing import Any, Self
from uuid import UUID

from pydantic import Field, model_validator

from polar.enums import AccountType
from polar.kit.schemas import Schema
from polar.models.account import Account as AccountModel


# Public API
class AccountLinkTypes(str, Enum):
    account_onboarding = "account_onboarding"
    account_update = "account_update"


# Public API
class AccountCreate(Schema):
    user_id: UUID | None = None
    organization_id: UUID | None = None

    account_type: AccountType
    open_collective_slug: str | None = Field(default=None, min_length=1)
    country: str = Field(
        description="Two letter uppercase country code", min_length=2, max_length=2
    )

    @model_validator(mode="after")
    def validate_open_collective(self) -> Self:
        if (
            self.account_type == AccountType.open_collective
            and self.open_collective_slug is None
        ):
            raise ValueError("The Open Collective slug must be provided.")
        return self

    @model_validator(mode="after")
    def validate_user_id_org_id(self) -> Self:
        if self.user_id and self.organization_id:
            raise ValueError("user_id and organization_id are mutually exclusive")
        if not self.user_id and not self.organization_id:
            raise ValueError("either user_id and organization_id must be set")
        return self

    @model_validator(mode="after")
    def validate_country(self) -> Self:
        if self.country.upper() != self.country:
            raise ValueError("country must be uppercase")
        return self


# Public API
class Account(Schema):
    id: UUID
    account_type: AccountType
    stripe_id: str | None = None
    open_collective_slug: str | None = None
    is_details_submitted: bool | None = None
    country: str = Field(min_length=2, max_length=2)

    @classmethod
    def from_db(cls, o: AccountModel) -> Self:
        return cls(
            id=o.id,
            account_type=o.account_type,
            stripe_id=o.stripe_id,
            open_collective_slug=o.open_collective_slug,
            is_details_submitted=o.is_details_submitted,
            country=o.country or "SE",
        )


class AccountUpdate(Schema):
    email: str | None = None
    country: str
    currency: str
    is_details_submitted: bool
    is_charges_enabled: bool
    is_payouts_enabled: bool
    data: dict[str, Any]


class AccountRead(AccountCreate):
    id: UUID
    account_type: AccountType
    stripe_id: str | None = None
    open_collective_slug: str | None = None
    balance: int | None = None
    balance_currency: str | None = None
    is_details_submitted: bool | None = None
    is_admin: bool | None = None


class AccountLink(Schema):
    url: str


class AccountLoginLink(Schema):
    created: int
    url: str


class OrganizationAccountPath(Schema):
    name: str = Field(..., description="Unique name identifier of the organization")


class OrganizationAccountLinkPath(OrganizationAccountPath):
    stripe_id: str = Field(..., description="Stripe ID of the account")
