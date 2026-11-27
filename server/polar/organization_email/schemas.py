from pydantic import Field

from polar.kit.schemas import Schema


class OrganizationEmailStatus(Schema):
    email: str | None = Field(description="Public support email.")
    verified: bool = Field(
        description="Whether the merchant verified this email with a code."
    )
    code_pending: bool = Field(
        description="Whether a code sent to this email is still valid and unused."
    )


class OrganizationEmailVerify(Schema):
    code: str = Field(
        min_length=6, max_length=6, description="The code received by email."
    )
