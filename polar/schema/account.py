from enum import Enum
from typing import Any

from pydantic import Field, SecretStr

from polar.models.account import Account
from polar.schema.base import Schema


class AccountLinkTypes(str, Enum):
    account_onboarding = "account_onboarding"
    account_update = "account_update"


class Base(Schema):
    organization_id: str
    email: SecretStr | None
    country: str | None
    currency: str | None
    is_details_submitted: bool
    is_charges_enabled: bool
    is_payouts_enabled: bool
    status: Account.Status = Account.Status.CREATED


class CreateAccount(Base):
    stripe_id: str
    is_personal: bool
    type: str
    data: dict[str, Any]


class UpdateAccount(Base):
    is_details_submitted: bool
    is_charges_enabled: bool
    is_payouts_enabled: bool
    data: dict[str, Any]


class AccountSchema(CreateAccount):
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
