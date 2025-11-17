from collections.abc import Sequence

from polar.models import ProductPrice


def get_default_price(prices: Sequence[ProductPrice]) -> ProductPrice:
    """
    Get the default price for a checkout session, given a list of product prices.

    We should select the static price in priority,
    as it determines the amount and specific behavior, like PWYW
    """
    for price in prices:
        if price.is_static:
            return price
    return prices[0]
