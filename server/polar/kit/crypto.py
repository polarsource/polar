import hashlib
import hmac
import secrets
import string
import zlib

from polar.config import HASH_SEPARATOR, settings


def _crc32_to_base62(number: int) -> str:
    characters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    base = len(characters)
    encoded = ""
    while number:
        number, remainder = divmod(number, base)
        encoded = characters[remainder] + encoded
    return encoded.zfill(6)  # Ensure the checksum is 6 characters long


def generate_token(*, prefix: str = "") -> str:
    # Generate a high entropy random token
    token = "".join(
        secrets.choice(string.ascii_letters + string.digits) for _ in range(37)
    )

    # Calculate a 32-bit CRC checksum
    checksum = zlib.crc32(token.encode("utf-8")) & 0xFFFFFFFF
    checksum_base62 = _crc32_to_base62(checksum)

    # Concatenate the prefix, token, and checksum
    return f"{prefix}{token}{checksum_base62}"


def _digest(token: str, secret: str) -> str:
    hash = hmac.new(secret.encode("ascii"), token.encode("ascii"), hashlib.sha256)
    return hash.hexdigest()


def get_token_hash(token: str) -> str:
    """HMAC-SHA256 of a token under the current secret. Only the hash is stored.

    Without a current secret, the hash is a bare digest under SECRET.
    """
    secret_id = settings.CURRENT_HASH_SECRET_ID
    if secret_id is None:
        return _digest(token, settings.SECRET)
    digest = _digest(token, settings.HASH_SECRETS[secret_id])
    return f"{secret_id}{HASH_SEPARATOR}{digest}"


def get_token_hash_candidates(token: str) -> dict[str | None, str]:
    """Every hash `token` could be stored as, keyed by secret id.

    A credential keeps its original hash until a lookup rewrites it, so a
    match has to try them all. `None` keys the bare digest under SECRET.
    """
    candidates: dict[str | None, str] = {
        secret_id: f"{secret_id}{HASH_SEPARATOR}{_digest(token, secret)}"
        for secret_id, secret in settings.HASH_SECRETS.items()
    }
    candidates[None] = _digest(token, settings.SECRET)
    return candidates


def generate_token_hash_pair(*, prefix: str = "") -> tuple[str, str]:
    """Returns the token and its hash. Only the hash is stored."""
    token = generate_token(prefix=prefix)
    return token, get_token_hash(token)
