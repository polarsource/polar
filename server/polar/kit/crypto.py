import hashlib
import hmac
import secrets
import string
import zlib

from polar.config import settings


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


def get_token_hash(token: str) -> str:
    """HMAC-SHA256 of a token under the current secret. Only the hash is stored.

    reauth hashes its own columns with its own copy of this, taking the secret
    as an argument: it cannot read `polar.config`.
    """
    hash = hmac.new(
        settings.SECRET.encode("ascii"), token.encode("ascii"), hashlib.sha256
    )
    return hash.hexdigest()


def generate_token_hash_pair(*, prefix: str = "") -> tuple[str, str]:
    """Returns the token and its hash. Only the hash is stored."""
    token = generate_token(prefix=prefix)
    return token, get_token_hash(token)
