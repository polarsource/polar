import asyncio
from datetime import datetime, timedelta
from typing import Any, Literal

import jwt

from polar.kit.signer import ALGORITHM, get_published_signers, get_signer, sign_jws

from .utils import utc_now

DEFAULT_EXPIRATION = 60 * 15  # 15 minutes

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


def _verification_key(token: str) -> Any:
    kid = jwt.get_unverified_header(token).get("kid")
    for signer in get_published_signers():
        if signer.kid == kid:
            return jwt.PyJWK(signer.public_jwk()).key
    raise DecodeError(f"No published key with id {kid}")


def decode_unsafe(*, token: str) -> dict[str, Any]:
    return jwt.decode(token, _verification_key(token), algorithms=[ALGORITHM])


async def decode(
    *,
    token: str,
    type: TYPE,
) -> dict[str, Any]:
    # Resolving the key is a blocking KMS call the first time a process sees it.
    res = await asyncio.to_thread(decode_unsafe, token=token)

    token_type = res.get("type", "")
    if token_type != type:
        raise InvalidTokenTypeError(
            f"JWT of unexpected type, expected '{type}' got '{token_type}'"
        )

    return res
