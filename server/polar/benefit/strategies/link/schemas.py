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


def _unescape_customer_placeholders(url: HttpUrl) -> str:
    return (
        str(url)
        .replace("%7BCUSTOMER_EMAIL%7D", CUSTOMER_EMAIL_PLACEHOLDER)
        .replace("%7BCUSTOMER_EXTERNAL_ID%7D", CUSTOMER_EXTERNAL_ID_PLACEHOLDER)
    )


LinkUrl = Annotated[
    HttpUrl,
    AfterValidator(_unescape_customer_placeholders),
    PlainSerializer(lambda x: x, return_type=str),
]
"""
HttpUrl percent-encodes `{CUSTOMER_EMAIL}` and `{CUSTOMER_EXTERNAL_ID}`, so we
unescape them after validation. These placeholders are replaced with the
customer's values when the benefit is granted
(see `polar.benefit.strategies.link.service.resolve_link_url`).
"""

Url = Annotated[
    LinkUrl,
    Field(
        description=(
            "The URL customers are directed to. Supports the `{CUSTOMER_EMAIL}` and "
            "`{CUSTOMER_EXTERNAL_ID}` placeholders, replaced with the customer's "
            "URL-encoded values when the benefit is granted. A missing external ID "
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
