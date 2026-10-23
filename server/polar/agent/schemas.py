from datetime import datetime
from typing import Literal

from pydantic import UUID4, EmailStr, Field

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
    claim_url: str = Field(description="Where to start a claim.")
    claim_token: str = Field(
        description="The secret to start a claim with. Returned only once."
    )
    claim_token_expires: datetime


class AgentClaimStart(Schema):
    claim_token: str
    email: EmailStr = Field(
        description="The email of the human who'll claim the agent. Only they can."
    )


class AgentClaimCeremony(Schema):
    user_code: str = Field(description="The code to give the human with the link.")
    expires_in: int = Field(description="Seconds until the link and code expire.")
    verification_uri: str = Field(description="The link to give the human.")
    interval: int = Field(description="Seconds to wait between two claim polls.")


class AgentClaimStarted(Schema):
    """A claim attempt, in the shape of the auth.md claim response."""

    registration_id: UUID4 = Field(description="The agent's ID.")
    claim_attempt_id: UUID4
    status: Literal["initiated"]
    expires_at: datetime
    claim_attempt: AgentClaimCeremony


class AgentClaimOrganization(Schema):
    id: UUID4
    name: str
    slug: str
    avatar_url: str | None


class AgentClaim(Schema):
    """What the human reviews before claiming the agent."""

    agent_name: str | None = Field(description="What the agent calls itself.")
    email: str = Field(description="The email the agent started the claim for.")
    expires_at: datetime
    organization: AgentClaimOrganization | None = Field(
        description="The organization the agent built, if any."
    )


class AgentClaimConfirm(Schema):
    link_token: str
    code: str = Field(pattern=r"^\d{6}$", description="The code the agent gave.")
