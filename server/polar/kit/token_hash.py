"""The one place that knows which secret hashes a token.

`polar.kit.crypto` stays free of any `polar.config` import: its purity is what
makes it a faithful mirror of `reauth.crypto`.
"""

from polar.config import settings
from polar.kit.crypto import generate_token, get_token_hash


def hash_token(token: str) -> str:
    return get_token_hash(token, secret=settings.SECRET)


def generate_token_hash(*, prefix: str = "") -> tuple[str, str]:
    """Returns the token and its hash. Only the hash is stored."""
    token = generate_token(prefix=prefix)
    return token, hash_token(token)
