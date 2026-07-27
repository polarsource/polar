from typing import Annotated

import langcodes
from pydantic import AfterValidator, Field


def _validate_locale(value: str) -> str:
    if not langcodes.tag_is_valid(value):
        raise ValueError("Invalid IETF BCP 47 language tag")
    locale = langcodes.Language.get(value)
    # Tags without a real language subtag (`und`, private-use `x-…`) are valid
    # BCP 47, but carry no language and `Intl` rejects the `x-…` form.
    if locale.language is None or len(locale.language) > 3:
        raise ValueError("Invalid IETF BCP 47 language tag")
    return langcodes.standardize_tag(value)


Locale = Annotated[
    str,
    Field(
        description=(
            "Locale of the customer, given as an IETF BCP 47 language tag, "
            "e.g. `en`, `en-US` or `en-GB-oxendict`. "
            "If `null` or unsupported, the locale will default to `en`."
        ),
        examples=["en", "en-US", "fr", "fr-CA"],
    ),
    AfterValidator(_validate_locale),
]
