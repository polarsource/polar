from typing import Annotated

from pydantic import AfterValidator, Field


def _normalize_locale(value: str) -> str:
    """Normalize locale to lowercase-UPPERCASE format (e.g. en-us → en-US)."""
    parts = value.split("-", 1)
    parts[0] = parts[0].lower()
    if len(parts) == 2:
        parts[1] = parts[1].upper()
    return "-".join(parts)


Locale = Annotated[
    str,
    Field(
        pattern=r"^[a-zA-Z]{2,3}(-[a-zA-Z]{2}|-[0-9]{3})?$",
        description=(
            "Locale of the customer, given as an IETF BCP 47 language tag. "
            "Supported: language code (e.g. `en`) or language + region (e.g. `en-US`). "
            "If `null` or unsupported, the locale will default to `en-US`."
        ),
        examples=["en", "en-US", "fr", "fr-CA"],
    ),
    AfterValidator(_normalize_locale),
]
