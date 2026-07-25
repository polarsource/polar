import re
from typing import Annotated, Literal

from pydantic import AfterValidator, Field, HttpUrl, PlainSerializer

from polar.kit.schemas import Schema
from polar.models.benefit import BenefitType

from ..base.schemas import (
    BenefitBase,
    BenefitCreateBase,
    BenefitSubscriberBase,
    BenefitUpdateBase,
)

CUSTOMER_EMAIL_PLACEHOLDER = "{CUSTOMER_EMAIL}"
CUSTOMER_EXTERNAL_ID_PLACEHOLDER = "{CUSTOMER_EXTERNAL_ID}"

_PLACEHOLDERS = (CUSTOMER_EMAIL_PLACEHOLDER, CUSTOMER_EXTERNAL_ID_PLACEHOLDER)
_ALLOWED_PLACEHOLDERS = ", ".join(_PLACEHOLDERS)

# HttpUrl percent-encodes braces in the path but leaves them intact in the query
# and fragment, so a placeholder can reach us in either form. Only variable-shaped
# contents are considered, so JSON-ish query values like `%7B"a":1%7D` pass through.
_PLACEHOLDER_RE = re.compile(r"(?:\{|%7B)(\w+)(?:\}|%7D)", re.IGNORECASE)


def _unescape_customer_placeholders(url: HttpUrl) -> str:
    value = str(url)
    for placeholder in _PLACEHOLDERS:
        encoded = placeholder.replace("{", "%7B").replace("}", "%7D")
        value = value.replace(encoded, placeholder)
    return value


def _validate_customer_placeholders(url: str) -> str:
    for match in _PLACEHOLDER_RE.finditer(url):
        if f"{{{match.group(1)}}}" not in _PLACEHOLDERS:
            raise ValueError(
                f"Unknown placeholder {{{match.group(1)}}}. "
                f"Supported placeholders: {_ALLOWED_PLACEHOLDERS}."
            )
    return url


LinkUrl = Annotated[
    HttpUrl,
    AfterValidator(_unescape_customer_placeholders),
    AfterValidator(_validate_customer_placeholders),
    PlainSerializer(lambda x: x, return_type=str),
]
"""
HttpUrl percent-encodes `{CUSTOMER_EMAIL}` and `{CUSTOMER_EXTERNAL_ID}`, so we
unescape them after validation, then reject any other placeholder. Unknown
placeholders are never substituted, so without this they would reach customers
verbatim. Supported placeholders are replaced with the customer's values when the
benefit is granted
(see `polar.benefit.strategies.link.service.resolve_link_url`).
"""

Url = Annotated[
    LinkUrl,
    Field(
        description=(
            "The URL customers are directed to. Supports the `{CUSTOMER_EMAIL}` and "
            "`{CUSTOMER_EXTERNAL_ID}` placeholders, replaced with the customer's "
            "URL-encoded values when the benefit is granted. Any other placeholder "
            "is rejected. A missing external ID "
            "is replaced with an empty string. These values are provided as a "
            "convenience for prefilling and reconciliation — they can be tampered "
            "with by the customer and must not be treated as authentication."
        ),
    ),
]

Label = Annotated[
    str,
    Field(
        min_length=1,
        max_length=42,
        description="Label of the call-to-action button shown to customers.",
    ),
]


class BenefitLinkProperties(Schema):
    """
    Properties for a benefit of type `link`.
    """

    url: str
    label: Label | None


class BenefitLinkCreateProperties(Schema):
    """
    Properties for creating a benefit of type `link`.
    """

    url: Url
    label: Label | None = None


class BenefitLinkSubscriberProperties(Schema):
    """
    Properties available to subscribers for a benefit of type `link`.
    """

    url: str
    label: Label | None


class BenefitLinkCreate(BenefitCreateBase):
    """
    Schema to create a benefit of type `link`.
    """

    type: Literal[BenefitType.link]
    properties: BenefitLinkCreateProperties


class BenefitLinkUpdate(BenefitUpdateBase):
    type: Literal[BenefitType.link]
    properties: BenefitLinkCreateProperties | None = None


class BenefitLink(BenefitBase):
    """
    A benefit of type `link`.

    Use it to direct customers to a URL, like your app's signup page.
    """

    type: Literal[BenefitType.link]
    properties: BenefitLinkProperties


class BenefitLinkSubscriber(BenefitSubscriberBase):
    type: Literal[BenefitType.link]
    properties: BenefitLinkSubscriberProperties
