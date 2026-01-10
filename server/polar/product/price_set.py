from collections.abc import Sequence
from typing import Self

from polar.exceptions import PolarError
from polar.models import Product, ProductPrice

from .guard import is_currency_price, is_free_price, is_static_price


class PriceSetError(PolarError): ...


class NoPricesForCurrency(PriceSetError):
    def __init__(self, currency: str) -> None:
        self.currency = currency
        message = f"No prices found for currency: {currency}"
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
    def from_product(
        cls,
        currency: str,
        product: Product,
    ) -> Self:
        return cls.from_prices(currency, product.prices)

    @classmethod
    def from_prices(cls, currency: str, prices: Sequence[ProductPrice]) -> Self:
        currency_prices = [
            price
            for price in prices
            if is_currency_price(price)
            and price.price_currency == currency
            or is_free_price(price)
        ]

        if not currency_prices:
            raise NoPricesForCurrency(currency)

        return cls(currency=currency, prices=currency_prices)

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


__all__ = [
    "NoPricesForCurrency",
    "PriceSet",
    "PriceSetError",
]
