from collections.abc import Sequence
from typing import Self

from polar.exceptions import PolarError, PolarRequestValidationError
from polar.kit.currency import (
    format_currency,
    get_maximum_currency_amount,
    get_minimum_currency_amount,
)
from polar.models import Product, ProductPrice

from .guard import is_custom_price, is_static_price


class PriceSetError(PolarError): ...


class NoPricesForCurrencies(PriceSetError):
    def __init__(self, currencies: list[str]) -> None:
        self.currencies = currencies
        message = f"No prices found for currencies: {currencies}"
        super().__init__(message)


class PriceSet:
    __slots__ = ("_iterable", "currency", "prices")

    def __init__(self, currency: str, prices: Sequence[ProductPrice]) -> None:
        self.currency = currency
        self.prices = prices

    def __iter__(self) -> Self:
        self._iterable = iter(self.prices)
        return self

    def __next__(self) -> ProductPrice:
        return next(self._iterable)

    def __len__(self) -> int:
        return len(self.prices)

    @classmethod
    def from_product(cls, product: Product, *currencies: str) -> Self:
        """Create a PriceSet from a product's prices filtered by currency.

        Args:
            product: The product containing prices to filter.
            *currencies: Currency codes in order of preference to filter prices by.

        Returns:
            A PriceSet containing prices matching the first available currency.

        Raises:
            NoPricesForCurrencies: If no prices are found for any of the
                specified currencies.
        """
        return cls.from_prices(product.prices, *currencies)

    @classmethod
    def from_prices(cls, prices: Sequence[ProductPrice], *currencies: str) -> Self:
        """Create a PriceSet from a sequence of prices filtered by currency.

        Iterates through the provided currencies in order of preference and
        returns a PriceSet with prices matching the first currency that has
        available prices.

        Args:
            prices: A sequence of ProductPrice objects to filter.
            *currencies: Currency codes in order of preference to filter prices by.

        Returns:
            A PriceSet containing prices matching the first available currency.

        Raises:
            NoPricesForCurrencies: If no prices are found for any of the
                specified currencies.
        """
        for currency in currencies:
            currency_prices = [
                price for price in prices if price.price_currency == currency
            ]

            if currency_prices:
                return cls(currency=currency, prices=currency_prices)

        raise NoPricesForCurrencies([*currencies])

    def get_default_price(self) -> ProductPrice:
        """
        Get the default price from a price set for a checkout session.

        We should select the static price in priority,
        as it determines the amount and specific behavior, like PWYW
        """
        for price in self.prices:
            if is_static_price(price):
                return price
        return self.prices[0]


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

    if price.minimum_amount == 0:
        # Free is allowed: accept 0, or any amount >= the currency minimum.
        if amount == 0:
            return
        currency_minimum = get_minimum_currency_amount(currency)
        if 0 < amount < currency_minimum:
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
    elif amount < price.minimum_amount:
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


__all__ = [
    "NoPricesForCurrencies",
    "PriceSet",
    "PriceSetError",
    "validate_custom_price_amount",
]
