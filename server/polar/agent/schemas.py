from datetime import datetime
from typing import Literal

from pydantic import UUID4, Field

from polar.auth.scope import Scope
from polar.kit.schemas import Schema


class AgentIdentityCreate(Schema):
    type: Literal["anonymous"]
    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
        description="What the agent calls itself. Shown to the human who claims it.",
    )


class AgentIdentity(Schema):
    """The agent's credentials, in the shape of the auth.md registration response."""

    registration_id: UUID4 = Field(description="The agent's ID.")
    registration_type: Literal["anonymous"]
    identity_assertion: str = Field(
        description=(
            "Exchange it for an access token with the "
            "`urn:ietf:params:oauth:grant-type:jwt-bearer` grant. "
            "Reusable until it expires."
        )
    )
    assertion_expires: datetime
    pre_claim_scopes: list[Scope] = Field(
        description="The scopes of the access tokens before a human claims the agent."
    )
    claim_token: str = Field(
        description="The secret to start a claim with. Returned only once."
    )
    claim_token_expires: datetime
