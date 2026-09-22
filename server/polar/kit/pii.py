import hashlib
import hmac

from polar.config import settings


def hash_pii(value: str) -> str:
    """Salted HMAC-SHA256 digest of a piece of personal data.

    Stored in place of the value when a column is only ever compared for
    equality: a lookup hashes what it's given and matches on the digest, so the
    value itself never has to be kept. Callers normalize first — two spellings
    of the same value have unrelated digests.

    The salt is a single static secret. Credential hashes rotate by rehashing
    the credential on its next use; there's no plaintext to rehash here, so a
    rotation would orphan every digest already stored.
    """
    return hmac.new(
        settings.PII_SCRUBBING_SALT.encode("utf-8"),
        value.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
