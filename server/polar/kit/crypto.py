import hashlib
import hmac
import secrets
import string
import zlib


def _crc32_to_base62(number: int) -> str:
    characters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    base = len(characters)
    encoded = ""
    while number:
        number, remainder = divmod(number, base)
        encoded = characters[remainder] + encoded
    return encoded.zfill(6)  # Ensure the checksum is 6 characters long


def get_token_hash(token: str, *, secret: str) -> str:
    hash = hmac.new(secret.encode("ascii"), token.encode("ascii"), hashlib.sha256)
    return hash.hexdigest()


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


def generate_token_hash_pair(*, secret: str, prefix: str = "") -> tuple[str, str]:
    """
    Generate a token suitable for sensitive values like API tokens.

    Returns both the actual value and its HMAC-SHA256 hash.
    Only the latter shall be stored in database.
    """
    token = generate_token(prefix=prefix)
    return token, get_token_hash(token, secret=secret)


def validate_token_checksum(token: str, *, prefix: str) -> bool:
    """
    Validate that a token has a valid CRC32 checksum.

    Tokens are structured as: {prefix}{37 random chars}{6 checksum chars}
    Returns True if the checksum is valid, False otherwise.
    """
    if not token.startswith(prefix):
        return False

    token_without_prefix = token[len(prefix) :]

    # Token should be 37 random chars + 6 checksum chars = 43 chars
    if len(token_without_prefix) != 43:
        return False

    random_part = token_without_prefix[:37]
    checksum_part = token_without_prefix[37:]

    expected_checksum = zlib.crc32(random_part.encode("utf-8")) & 0xFFFFFFFF
    expected_checksum_base62 = _crc32_to_base62(expected_checksum)

    return checksum_part == expected_checksum_base62
