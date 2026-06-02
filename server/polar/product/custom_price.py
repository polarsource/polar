from polar.exceptions import PolarRequestValidationError
from polar.kit.currency import (
    format_currency,
    get_maximum_currency_amount,
    get_minimum_currency_amount,
)
from polar.models import ProductPrice

from .guard import is_custom_price


def validate_custom_price_amount(
    price: ProductPrice,
    amount: int,
    currency: str,
    loc: tuple[str, ...] = ("body", "amount"),
) -> None:
    """Validate a custom (pay-what-you-want) amount against the price's
    configured minimum/maximum and the currency's minimum/maximum.

    No-op for non-custom prices. Shared by the checkout and off-session order
    flows so both enforce identical bounds.
    """
    if not is_custom_price(price):
        return

    if amount < 0:
        raise PolarRequestValidationError(
            [
                {
                    "type": "greater_than_equal",
                    "loc": loc,
                    "msg": "Amount must be at least 0.",
                    "input": amount,
                    "ctx": {"ge": 0},
                }
            ]
        )

    # Enforce the price's configured minimum (0 means free / pay-what-you-want
    # is allowed, so a 0 amount passes here).
    if amount < price.minimum_amount:
        raise PolarRequestValidationError(
            [
                {
                    "type": "greater_than_equal",
                    "loc": loc,
                    "msg": "Amount is below minimum.",
                    "input": amount,
                    "ctx": {"ge": price.minimum_amount},
                }
            ]
        )

    # A positive amount must always clear the processor floor for the currency,
    # regardless of the configured minimum — otherwise it would pass here but
    # fail when we try to charge it. (Mirrors the currency-maximum check below.)
    if amount > 0:
        currency_minimum = get_minimum_currency_amount(currency)
        if amount < currency_minimum:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "invalid_amount",
                        "loc": loc,
                        "msg": (
                            "Amount must be 0 or at least "
                            f"{format_currency(currency_minimum, currency)}."
                        ),
                        "input": amount,
                        "ctx": {"allowed": [0], "ge": currency_minimum},
                    }
                ]
            )

    if price.maximum_amount is not None and amount > price.maximum_amount:
        raise PolarRequestValidationError(
            [
                {
                    "type": "less_than_equal",
                    "loc": loc,
                    "msg": "Amount is above maximum.",
                    "input": amount,
                    "ctx": {"le": price.maximum_amount},
                }
            ]
        )

    currency_maximum = get_maximum_currency_amount(currency)
    if amount > currency_maximum:
        raise PolarRequestValidationError(
            [
                {
                    "type": "less_than_equal",
                    "loc": loc,
                    "msg": (
                        "Amount must be at most "
                        f"{format_currency(currency_maximum, currency)}."
                    ),
                    "input": amount,
                    "ctx": {"le": currency_maximum},
                }
            ]
        )


__all__ = ["validate_custom_price_amount"]
