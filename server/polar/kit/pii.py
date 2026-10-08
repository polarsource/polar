import hashlib
import hmac

from polar.config import settings


def hash_pii(value: str) -> str:
    """Salted HMAC-SHA256 digest of a piece of personal data."""
    return hmac.new(
        settings.PII_SCRUBBING_SALT.encode("utf-8"),
        value.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
