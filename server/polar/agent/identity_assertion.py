"""The identity assertion an agent trades for access tokens (RFC 7523).

A JWT signed with the key that signs our ID tokens. Its `type` claim keeps it
apart from every other JWT Polar signs: `polar.kit.jwt.decode` rejects any other
type, and the ID tokens and SSO client assertions carry no `type` at all.
"""

import dataclasses
from datetime import UTC, datetime, timedelta
from typing import Final
from uuid import UUID

from polar.kit import jwt
from polar.kit.utils import utc_now
from polar.oauth2.constants import ISSUER

IDENTITY_ASSERTION_TYPE: Final = "agent_identity_assertion"
IDENTITY_ASSERTION_TTL = timedelta(days=30)


@dataclasses.dataclass(frozen=True)
class IdentityAssertion:
    token: str
    expires_at: datetime


@dataclasses.dataclass(frozen=True)
class IdentityAssertionClaims:
    agent_id: UUID
    issued_at: datetime


def create_identity_assertion(agent_id: UUID) -> IdentityAssertion:
    issued_at = utc_now().replace(microsecond=0)
    expires_at = issued_at + IDENTITY_ASSERTION_TTL
    token = jwt.encode_sync(
        data={
            "iss": ISSUER,
            "aud": ISSUER,
            "sub": str(agent_id),
            "iat": int(issued_at.timestamp()),
        },
        expires_at=expires_at,
        type=IDENTITY_ASSERTION_TYPE,
    )
    return IdentityAssertion(token=token, expires_at=expires_at)


def decode_identity_assertion(token: str) -> IdentityAssertionClaims:
    """Raises `polar.kit.jwt.InvalidTokenError` if the assertion isn't valid."""
    claims = jwt.decode_sync(
        token=token,
        type=IDENTITY_ASSERTION_TYPE,
        audience=ISSUER,
        issuer=ISSUER,
        require=["exp", "iat", "sub"],
    )
    try:
        agent_id = UUID(claims["sub"])
    except ValueError as e:
        raise jwt.InvalidTokenError("Invalid 'sub' claim") from e
    return IdentityAssertionClaims(
        agent_id=agent_id, issued_at=datetime.fromtimestamp(claims["iat"], UTC)
    )
