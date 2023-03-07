from enum import Enum

# TODO: Remove this abstraction?
# We will likely want to support Gitlab users in the near future so this
# abstraction is here to hopefully support a drop-in – albeit custom – Gitlab client.


class Platforms(str, Enum):
    github = "github"
