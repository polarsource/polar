import base64
import json
from datetime import timedelta

import jwt as pyjwt
import pytest

from polar.kit import jwt
from polar.kit.signer import get_signer, sign_jws
from polar.kit.utils import utc_now

CLAIMS = {"user_id": "b3a1c9d2", "type": "discord_oauth"}


def _signed(expires_in: timedelta = timedelta(minutes=15)) -> str:
    return sign_jws(
        {**CLAIMS, "exp": int((utc_now() + expires_in).timestamp())}, get_signer()
    )


def _with_kid(token: str, kid: str) -> str:
    header = base64.urlsafe_b64encode(
        json.dumps({"typ": "JWT", "alg": "RS256", "kid": kid}).encode()
    ).rstrip(b"=")
    _, claims, signature = token.split(".")
    return f"{header.decode()}.{claims}.{signature}"


@pytest.mark.asyncio
async def test_encode_signs_with_the_current_key() -> None:
    token = await jwt.encode(data=dict(CLAIMS), type="discord_oauth")

    assert pyjwt.get_unverified_header(token)["kid"] == get_signer().kid
    decoded = await jwt.decode(token=token, type="discord_oauth")
    assert decoded["user_id"] == CLAIMS["user_id"]


@pytest.mark.asyncio
async def test_rejects_a_token_signed_by_an_unpublished_key() -> None:
    with pytest.raises(jwt.DecodeError):
        await jwt.decode(
            token=_with_kid(_signed(), "unpublished"),
            type="discord_oauth",
        )


@pytest.mark.asyncio
async def test_guards_the_token_type_of_a_signed_token() -> None:
    with pytest.raises(jwt.InvalidTokenTypeError):
        await jwt.decode(token=_signed(), type="customer_oauth")


@pytest.mark.asyncio
async def test_expired_signed_token_raises_expired_signature() -> None:
    with pytest.raises(jwt.ExpiredSignatureError):
        await jwt.decode(
            token=_signed(expires_in=timedelta(minutes=-1)),
            type="discord_oauth",
        )
