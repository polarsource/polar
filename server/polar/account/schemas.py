from enum import Enum

from pydantic import Field

from polar.kit.schemas import Schema
from polar.enums import AccountType


class AccountLinkTypes(str, Enum):
    account_onboarding = "account_onboarding"
    account_update = "account_update"


class Base(Schema):
    type: AccountType


class AccountCreate(Base):
    ...


class AccountUpdate(Base):
    ...


class AccountRead(AccountCreate):
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
