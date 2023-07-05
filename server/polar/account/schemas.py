from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import Field, root_validator

from polar.enums import AccountType
from polar.kit.schemas import Schema


class AccountLinkTypes(str, Enum):
    account_onboarding = "account_onboarding"
    account_update = "account_update"


class AccountCreate(Schema):
    account_type: AccountType
    open_collective_slug: str | None = None
    country: str

    @root_validator
    def validate_open_collective(cls, values: dict[str, Any]) -> dict[str, Any]:
        account_type: AccountType = values["account_type"]
        open_collective_slug: str | None = values.get("open_collective_slug")
        if account_type == AccountType.open_collective and open_collective_slug is None:
            raise ValueError(
                "open_collective_slug must be provided for an OpenCollective account."
            )
        return values


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
    type: str = "account_link"
    created: int
    url: str


class AccountLoginLink(Schema):
    created: int
    url: str


class OrganizationAccountPath(Schema):
    name: str = Field(..., description="Unique name identifier of the organization")


class OrganizationAccountLinkPath(OrganizationAccountPath):
    stripe_id: str = Field(..., description="Stripe ID of the account")
