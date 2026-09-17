import asyncio
from datetime import datetime, timedelta
from typing import Any, Literal

import jwt

from polar.kit.signer import ALGORITHM as ASYMMETRIC_ALGORITHM
from polar.kit.signer import get_published_signers, get_signer, sign_jws

from .utils import utc_now

DEFAULT_EXPIRATION = 60 * 15  # 15 minutes
ALGORITHM = "HS256"

DecodeError = jwt.DecodeError
ExpiredSignatureError = jwt.ExpiredSignatureError


class InvalidTokenTypeError(DecodeError): ...


def create_expiration_dt(seconds: int) -> datetime:
    return utc_now() + timedelta(seconds=seconds)


TYPE = Literal[
    "discord_oauth",
    "github_repository_benefit_oauth",
    "customer_oauth",
    "slack_integration_oauth",
]


async def encode(
    *,
    data: dict[str, Any],
    expires_at: datetime | None = None,
    expires_in: int | None = DEFAULT_EXPIRATION,
    type: TYPE,
) -> str:
    if not expires_at:
        expires_at = create_expiration_dt(seconds=expires_in or DEFAULT_EXPIRATION)

    claims = {**data, "type": type, "exp": int(expires_at.timestamp())}
    # Signing is a blocking KMS call in production.
    return await asyncio.to_thread(sign_jws, claims, get_signer())


def _verification_key(token: str, secret: str) -> tuple[Any, str]:
    kid = jwt.get_unverified_header(token).get("kid")
    if kid is None:
        return secret, ALGORITHM
    for signer in get_published_signers():
        if signer.kid == kid:
            return jwt.PyJWK(signer.public_jwk()).key, ASYMMETRIC_ALGORITHM
    raise DecodeError(f"No published key with id {kid}")


def decode_unsafe(*, token: str, secret: str) -> dict[str, Any]:
    key, algorithm = _verification_key(token, secret)
    return jwt.decode(token, key, algorithms=[algorithm])


async def decode(
    *,
    token: str,
    secret: str,
    type: TYPE,
) -> dict[str, Any]:
    # Resolving the key is a blocking KMS call the first time a process sees it.
    res = await asyncio.to_thread(decode_unsafe, token=token, secret=secret)

    token_type = res.get("type", "")
    if token_type != type:
        raise InvalidTokenTypeError(
            f"JWT of unexpected type, expected '{type}' got '{token_type}'"
        )

    return res
