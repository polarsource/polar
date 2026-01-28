import hashlib
import hmac
import secrets
import string
import zlib

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from polar.config import settings


class CryptoError(Exception):
    """Base exception for crypto operations."""

    pass


class EncryptionKeyNotConfigured(CryptoError):
    """Raised when encryption key is not set."""

    pass


class DecryptionError(CryptoError):
    """Raised when decryption fails."""

    pass


def _get_fernet() -> Fernet | MultiFernet:
    """
    Get the Fernet instance for encryption/decryption.

    Supports key rotation via comma-separated keys in ENCRYPTION_KEY.
    The first key is used for encryption, all keys are tried for decryption.
    """
    key_string = getattr(settings, "ENCRYPTION_KEY", None)
    if not key_string:
        raise EncryptionKeyNotConfigured(
            "ENCRYPTION_KEY environment variable is not set. "
            "Generate one with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
        )

    keys = [k.strip() for k in key_string.split(",") if k.strip()]
    if len(keys) == 1:
        return Fernet(keys[0].encode())

    # Multiple keys for rotation support
    return MultiFernet([Fernet(k.encode()) for k in keys])


def encrypt_string(plaintext: str) -> bytes:
    """
    Encrypt a string and return the ciphertext as bytes.

    Args:
        plaintext: The string to encrypt

    Returns:
        Encrypted bytes (Fernet token)
    """
    fernet = _get_fernet()
    return fernet.encrypt(plaintext.encode())


def decrypt_string(ciphertext: bytes) -> str:
    """
    Decrypt ciphertext and return the plaintext string.

    Args:
        ciphertext: The encrypted bytes (Fernet token)

    Returns:
        Decrypted string

    Raises:
        DecryptionError: If decryption fails
    """
    try:
        fernet = _get_fernet()
        return fernet.decrypt(ciphertext).decode()
    except InvalidToken as e:
        raise DecryptionError("Failed to decrypt data") from e


def generate_encryption_key() -> str:
    """Generate a new Fernet encryption key."""
    return Fernet.generate_key().decode()


def mask_account_number(account_number: str) -> str:
    """
    Return masked account number showing only last 4 digits.

    Example: "123456789" -> "****6789"
    """
    if len(account_number) <= 4:
        return account_number
    return "****" + account_number[-4:]


def get_last4(value: str) -> str:
    """Extract last 4 characters of a string."""
    return value[-4:] if len(value) >= 4 else value


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
