from enum import StrEnum


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


class TokenType(StrEnum):
    client_secret = "client_secret"
    client_registration_token = "client_registration_token"
    authorization_code = "authorization_code"
    access_token = "access_token"
    refresh_token = "refresh_token"
    personal_access_token = "personal_access_token"
