from enum import StrEnum

from pydantic import GetJsonSchemaHandler
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import CoreSchema


class Platforms(StrEnum):
    github = "github"

    @classmethod
    def __get_pydantic_json_schema__(
        cls, core_schema: CoreSchema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        """
        Workaround to force Pydantic to generate an enum schema
        even if there is only one item.
        """
        return {"enum": ["github"], "type": "string", "title": "Platforms"}


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
