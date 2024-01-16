from enum import StrEnum


class Platforms(StrEnum):
    github = "github"


class UserSignupType(StrEnum):
    maintainer = "maintainer"
    backer = "backer"


class AccountType(StrEnum):
    stripe = "stripe"
    open_collective = "open_collective"

    @classmethod
    def get_display_name(cls, v: "AccountType") -> str:
        return {
            AccountType.stripe: "Stripe",
            AccountType.open_collective: "Open Collective",
        }[v]
