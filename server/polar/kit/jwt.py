from datetime import datetime, timedelta
from typing import Any, Literal

import jwt

from .utils import utc_now

DEFAULT_EXPIRATION = 60 * 15  # 15 minutes
ALGORITHM = "HS256"

DecodeError = jwt.DecodeError
ExpiredSignatureError = jwt.ExpiredSignatureError


def create_expiration_dt(seconds: int) -> datetime:
    return utc_now() + timedelta(seconds=seconds)


def encode(
    *,
    data: dict[str, Any],
    secret: str,
    expires_at: datetime | None = None,
    expires_in: int | None = DEFAULT_EXPIRATION,
    type: Literal["custom_domain_forward"] | None = None,  # TODO: make required
) -> str:
    if type:
        data["type"] = type

    to_encode = data.copy()
    if not expires_at:
        expires_in = expires_in or DEFAULT_EXPIRATION
        expires_at = create_expiration_dt(seconds=expires_in)

    to_encode["exp"] = expires_at
    return jwt.encode(to_encode, secret, algorithm=ALGORITHM)


def decode(*, token: str, secret: str) -> dict[str, Any]:
    return jwt.decode(token, secret, algorithms=[ALGORITHM])
