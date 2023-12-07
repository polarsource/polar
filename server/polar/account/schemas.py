from enum import Enum
from typing import Any, Self
from uuid import UUID

from pydantic import Field, root_validator

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

    @root_validator(skip_on_failure=True)
    def validate_open_collective(cls, values: dict[str, Any]) -> dict[str, Any]:
        account_type: AccountType = values["account_type"]
        open_collective_slug: str | None = values.get("open_collective_slug")
        if account_type == AccountType.open_collective and open_collective_slug is None:
            raise ValueError("The Open Collective slug must be provided.")
        return values

    @root_validator(skip_on_failure=True)
    def validate_user_id_org_id(cls, values: dict[str, Any]) -> dict[str, Any]:
        user_id: UUID | None = values["user_id"]
        organization_id: UUID | None = values["organization_id"]

        if user_id and organization_id:
            raise ValueError("user_id and organization_id are mutually exclusive")
        if not user_id and not organization_id:
            raise ValueError("either user_id and organization_id must be set")

        return values

    @root_validator(skip_on_failure=True)
    def validate_country(cls, values: dict[str, Any]) -> dict[str, Any]:
        country: str = values["country"]
        if country.upper() != country:
            raise ValueError("country must be uppercase")
        return values


# Public API
class Account(Schema):
    id: UUID
    account_type: AccountType
    status: AccountModel.Status
    stripe_id: str | None
    open_collective_slug: str | None
    is_details_submitted: bool | None
    country: str = Field(min_length=2, max_length=2)

    @classmethod
    def from_db(cls, o: AccountModel) -> Self:
        return cls(
            id=o.id,
            account_type=o.account_type,
            status=o.status,
            stripe_id=o.stripe_id,
            open_collective_slug=o.open_collective_slug,
            is_details_submitted=o.is_details_submitted,
            country=o.country or "SE",
        )


class AccountUpdate(Schema):
    email: str | None
    country: str
    currency: str
    is_details_submitted: bool
    is_charges_enabled: bool
    is_payouts_enabled: bool
    data: dict[str, Any]


class AccountRead(AccountCreate):
    id: UUID
    account_type: AccountType
    stripe_id: str | None
    open_collective_slug: str | None
    balance: int | None
    balance_currency: str | None
    is_details_submitted: bool | None
    is_admin: bool | None

    class Config:
        orm_mode = True


class AccountLink(Schema):
    url: str


class AccountLoginLink(Schema):
    created: int
    url: str


class OrganizationAccountPath(Schema):
    name: str = Field(..., description="Unique name identifier of the organization")


class OrganizationAccountLinkPath(OrganizationAccountPath):
    stripe_id: str = Field(..., description="Stripe ID of the account")
