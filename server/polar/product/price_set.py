from collections.abc import Sequence
from typing import Self

from polar.exceptions import PolarError
from polar.models import Product, ProductPrice

from .guard import (
    CustomPrice,
    SeatPrice,
    is_custom_price,
    is_fixed_price,
    is_free_price,
    is_seat_price,
    is_static_price,
)


def _static_price_order(price: ProductPrice) -> int:
    """Canonical ordering for static prices: Free → Fixed → Seat → Custom.

    The Fixed-before-Seat part is load-bearing: a fixed-amount discount is
    allocated as a waterfall across prices in this order, so the base fee
    absorbs the discount before the seat charge.
    """
    if is_free_price(price):
        return 0
    if is_fixed_price(price):
        return 1
    if is_seat_price(price):
        return 2
    if is_custom_price(price):
        return 3

    raise ValueError(f"unexpected price type: {price.type}")


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

    def get_static_prices(self) -> list[ProductPrice]:
        """Return every static price in the set in canonical order.

        Ordering is Free → Fixed → Seat → Custom (see ``_static_price_order``).
        Consumers that allocate a discount across prices rely on this order.
        """
        static_prices = [price for price in self.prices if is_static_price(price)]
        return sorted(static_prices, key=_static_price_order)

    def get_seat_price(self) -> SeatPrice | None:
        """Return the lone seat-based price in the set, if any."""
        for price in self.prices:
            if is_seat_price(price):
                return price
        return None

    def get_custom_price(self) -> CustomPrice | None:
        """Return the lone custom (pay-what-you-want) price in the set, if any."""
        for price in self.prices:
            if is_custom_price(price):
                return price
        return None


def calculate_upfront_amount(
    prices: Sequence[ProductPrice],
    *,
    custom_amount: int | None,
    seats: int | None,
) -> int:
    """Sum the upfront amount charged for a checkout across a set of prices.

    Each price contributes according to its type:
    - fixed: its configured amount
    - custom: the buyer-provided ``custom_amount`` (``0`` is honored), falling
      back to the price's preset or minimum when ``None``
    - seat: the amount for ``seats`` seats
    - free / metered: nothing upfront
    """
    amount = 0
    for price in prices:
        if is_fixed_price(price):
            amount += price.price_amount
        elif is_custom_price(price):
            if custom_amount is not None:
                amount += custom_amount
            elif price.preset_amount is not None:
                # A configured preset of 0 ("show $0 default") is honored; only a
                # missing preset falls back to the minimum.
                amount += price.preset_amount
            else:
                amount += price.minimum_amount
        elif is_seat_price(price):
            if seats is None:
                raise ValueError("seats must be provided to price a seat-based price")
            amount += price.calculate_amount(seats)
    return amount


__all__ = [
    "NoPricesForCurrencies",
    "PriceSet",
    "PriceSetError",
    "calculate_upfront_amount",
]
