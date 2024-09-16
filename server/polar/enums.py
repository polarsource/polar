from enum import StrEnum
from typing import Literal, cast


class Platforms(StrEnum):
    github = "github"


class UserSignupType(StrEnum):
    maintainer = "maintainer"
    backer = "backer"
    imported = "imported"


class AccountType(StrEnum):
    stripe = "stripe"
    open_collective = "open_collective"

    @classmethod
    def get_display_name(cls, v: "AccountType") -> str:
        return {
            AccountType.stripe: "Stripe",
            AccountType.open_collective: "Open Collective",
        }[v]


class SubscriptionRecurringInterval(StrEnum):
    month = "month"
    year = "year"

    def as_literal(self) -> Literal["month", "year"]:
        return cast(Literal["month", "year"], self.value)


class TokenType(StrEnum):
    client_secret = "client_secret"
    client_registration_token = "client_registration_token"
    authorization_code = "authorization_code"
    access_token = "access_token"
    refresh_token = "refresh_token"
    personal_access_token = "personal_access_token"
