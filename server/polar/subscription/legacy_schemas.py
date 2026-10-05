from typing import Any

from pydantic import Field, field_validator
from pydantic.json_schema import SkipJsonSchema

from . import schemas


def _ignore_currency(value: Any) -> None:
    return None


class SubscriptionCreateCustomer(schemas.SubscriptionCreateCustomer):
    """
    Create a subscription for an existing customer.
    """

    currency: SkipJsonSchema[None] = Field(default=None, exclude=True)

    _ignore_currency = field_validator("currency", mode="plain")(_ignore_currency)


class SubscriptionCreateExternalCustomer(schemas.SubscriptionCreateExternalCustomer):
    """
    Create a subscription for an existing customer identified by an external ID.
    """

    currency: SkipJsonSchema[None] = Field(default=None, exclude=True)

    _ignore_currency = field_validator("currency", mode="plain")(_ignore_currency)


SubscriptionCreate = SubscriptionCreateCustomer | SubscriptionCreateExternalCustomer
