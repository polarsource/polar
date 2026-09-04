from datetime import UTC, datetime

WEBHOOK_SECRET_PREFIX = "whsec_"
WEBHOOK_SECRET_KEY_BYTES = 32

# Secrets created before this instant keep Polar's original HMAC (UTF-8 of the
# full `whsec_…` string). That includes endpoints stamped with
# `secret_generated_at` after that column shipped but before spec signing.
# Bump this if deploy slips so those rows do not flip scheme.
WEBHOOK_STANDARD_SIGNATURE_CUTOFF = datetime(2026, 9, 8, tzinfo=UTC)


def uses_standard_webhook_signature(secret_generated_at: datetime | None) -> bool:
    if secret_generated_at is None:
        return False
    generated_at = secret_generated_at
    if generated_at.tzinfo is None:
        generated_at = generated_at.replace(tzinfo=UTC)
    return generated_at >= WEBHOOK_STANDARD_SIGNATURE_CUTOFF
