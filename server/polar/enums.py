from enum import StrEnum
from typing import Literal, cast


class Platforms(StrEnum):
    github = "github"


class UserSignupType(StrEnum):
    maintainer = "maintainer"
    backer = "backer"
    imported = "imported"


class PaymentProcessor(StrEnum):
    stripe = "stripe"


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
    client_secret = "polar_client_secret"
    client_registration_token = "polar_client_registration_token"
    authorization_code = "polar_authorization_code"
    access_token = "polar_access_token"
    refresh_token = "polar_refresh_token"
    personal_access_token = "polar_personal_access_token"
