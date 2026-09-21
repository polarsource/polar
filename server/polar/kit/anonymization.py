import hashlib
from datetime import datetime
from typing import Any

from polar.kit.address import Address


def anonymize_for_deletion(value: str, created_at: datetime) -> str:
    ret = hashlib.sha256()
    ret.update(created_at.isoformat().encode("utf-8"))
    ret.update(value.encode("utf-8"))
    return ret.hexdigest()


ANONYMIZED_EMAIL_DOMAIN = "anonymized.polar.sh"

# The unspecified address: a valid IP carrying no information. Used where an IP
# was recorded but erased, since a hash is not a valid IP address.
ANONYMIZED_IP_ADDRESS = "0.0.0.0"


def anonymize_email_for_deletion(email: str, created_at: datetime) -> str:
    assert "@" in email

    return f"{anonymize_for_deletion(email, created_at)}@{ANONYMIZED_EMAIL_DOMAIN}"


def anonymize_address_for_deletion(address: Address, created_at: datetime) -> Address:
    """Hash the street-level parts of an address, keeping its jurisdiction.

    Country and state are kept: they are the tax jurisdiction rather than
    identifying details, and `Address` cannot be built without a valid country.
    """
    return Address(
        line1=_anonymize_optional(address.line1, created_at),
        line2=_anonymize_optional(address.line2, created_at),
        postal_code=_anonymize_optional(address.postal_code, created_at),
        city=_anonymize_optional(address.city, created_at),
        state=address.state,
        country=address.country,
    )


def anonymize_metadata_for_deletion(
    metadata: dict[str, Any], created_at: datetime
) -> dict[str, Any]:
    """Hash metadata values, keeping the keys the merchant set."""
    return {
        key: anonymize_for_deletion(str(value), created_at)
        for key, value in metadata.items()
    }


def _anonymize_optional(value: str | None, created_at: datetime) -> str | None:
    if value is None:
        return None
    return anonymize_for_deletion(value, created_at)
