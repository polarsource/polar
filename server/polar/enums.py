from enum import Enum, StrEnum


# TODO: Remove this abstraction?
# We will likely want to support Gitlab users in the near future so this
# abstraction is here to hopefully support a drop-in – albeit custom – Gitlab client.
class Platforms(str, Enum):
    github = "github"


class UserSignupType(StrEnum):
    maintainer = "maintainer"
    backer = "backer"


class AccountType(str, Enum):
    stripe = "stripe"
    open_collective = "open_collective"
