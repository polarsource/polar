from enum import Enum
from typing import Any

from pydantic import Field

from polar.kit.schemas import Schema
from polar.enums import AccountType


class AccountLinkTypes(str, Enum):
    account_onboarding = "account_onboarding"
    account_update = "account_update"


class AccountCreate(Schema):
    account_type: AccountType | None


class AccountUpdate(Schema):
    email: str | None
    country: str
    currency: str
    is_details_submitted: bool
    is_charges_enabled: bool
    is_payouts_enabled: bool
    data: dict[str, Any]


class AccountRead(AccountCreate):
    account_type: AccountType | None
    stripe_id: str

    class Config:
        orm_mode = True


class AccountLink(Schema):
    type: str = "account_link"
    created: int
    expires_at: int
    url: str


class AccountLoginLink(Schema):
    created: int
    url: str


class OrganizationAccountPath(Schema):
    name: str = Field(..., description="Unique name identifier of the organization")


class OrganizationAccountLinkPath(OrganizationAccountPath):
    stripe_id: str = Field(..., description="Stripe ID of the account")
