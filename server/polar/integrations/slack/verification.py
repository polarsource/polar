import hashlib
import hmac
import time

_VERSION = "v0"
_MAX_CLOCK_SKEW_SECONDS = 60 * 5


def verify_slack_signature(
    *,
    signing_secret: str,
    request_body: bytes,
    signature_header: str,
    timestamp_header: str,
    now: float | None = None,
) -> bool:
    """Verify a request signature per https://api.slack.com/authentication/verifying-requests-from-slack.

    Returns True only if the signature matches *and* the timestamp is within
    the 5-minute replay window.
    """
    try:
        timestamp = int(timestamp_header)
    except (TypeError, ValueError):
        return False

    current = now if now is not None else time.time()
    if abs(current - timestamp) > _MAX_CLOCK_SKEW_SECONDS:
        return False

    basestring = f"{_VERSION}:{timestamp}:".encode() + request_body
    digest = hmac.new(signing_secret.encode(), basestring, hashlib.sha256).hexdigest()
    expected = f"{_VERSION}={digest}"
    try:
        return hmac.compare_digest(expected, signature_header)
    except TypeError:
        return False
