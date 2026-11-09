import collections.abc
import dataclasses
import typing

from polar.config.benefits import Benefit
from polar.config.definitions import DefinitionSet, VisibleDefinition, definition_fields
from polar.config.prices import (
    Metered,
    Price,
    price_configs,
    price_currencies,
    same_currencies,
)
from polar.{{ latest }}.inputs import ConfigProduct, ConfigProductPrice
from polar.{{ latest }}.literals import PresentmentCurrency, RecurringInterval

Cadence: typing.TypeAlias = typing.Literal["daily", "weekly", "monthly", "yearly"]
Interval: typing.TypeAlias = typing.Literal[
    "day", "days", "week", "weeks", "month", "months", "year", "years"
]  # fmt: skip
Period: typing.TypeAlias = Cadence | tuple[int, Interval]
Cycle: typing.TypeAlias = tuple[RecurringInterval, int]


CADENCES: dict[str, RecurringInterval] = {
    "daily": "day",
    "weekly": "week",
    "monthly": "month",
    "yearly": "year",
}
INTERVALS: tuple[RecurringInterval, ...] = ("day", "week", "month", "year")


@dataclasses.dataclass(frozen=True, kw_only=True)
class Product(VisibleDefinition):
    """A product with its prices.

    `recurring="monthly"` or `recurring=(3, "months")` bills on a cycle; without it the
    product is a one-time purchase. `grants` lists benefits from a `BenefitSet`.
    """

    name: str | None = dataclasses.field(default=None, kw_only=False)
    prices: collections.abc.Sequence[Price]
    recurring: Period | None = None
    trial: tuple[int, Interval] | None = None
    meter_cycle: Period | None = None
    grants: collections.abc.Sequence[Benefit] = ()
    description: str | None = None

    def __post_init__(self) -> None:
        if not self.prices:
            raise ValueError("A product needs at least one price.")
        if self.recurring is None and (
            self.trial is not None or self.meter_cycle is not None
        ):
            raise ValueError("A trial or meter cycle needs a recurring product.")
        _cycles(self)

    def describe(self) -> str:
        return repr(self.name) if self.name else super().describe()

    @property
    def cycles(self) -> dict[str, Cycle]:
        return _cycles(self)


class ProductSet(DefinitionSet[Product]):
    item = Product


def product_config(
    definition: Product, default_currency: PresentmentCurrency | None
) -> ConfigProduct:
    config: dict[str, typing.Any] = {
        "external_id": definition.id,
        "name": definition.name if definition.name is not None else definition.id,
        "prices": _product_prices(definition, default_currency),
        "benefits": [benefit.id for benefit in definition.grants],
        **definition_fields(definition),
    }
    for kind, (interval, count) in definition.cycles.items():
        config[f"{kind}_interval"] = interval
        config[f"{kind}_interval_count"] = count
    if definition.description is not None:
        config["description"] = definition.description
    return typing.cast(ConfigProduct, config)


def _cycle(period: Period, where: str) -> Cycle:
    if isinstance(period, str) and period in CADENCES:
        return CADENCES[period], 1
    if isinstance(period, tuple) and len(period) == 2:
        count, interval = period
        unit = interval.removesuffix("s")
        if isinstance(count, int) and unit in INTERVALS:
            return unit, count
    raise ValueError(
        f'{where} takes a cadence like "monthly", or a count and an interval like (3, "months").'
    )


def _cycles(product: "Product") -> dict[str, Cycle]:
    cycles: dict[str, Cycle] = {}
    if product.recurring is not None:
        cycles["recurring"] = _cycle(product.recurring, "recurring")
    if product.trial is not None:
        cycles["trial"] = _cycle(product.trial, "trial")
    if product.meter_cycle is not None:
        cycles["meter"] = _cycle(product.meter_cycle, "meter_cycle")
    return cycles


def _product_prices(
    definition: Product, default_currency: PresentmentCurrency | None
) -> list[ConfigProductPrice]:
    """Every price in a product must be set in the same currencies."""
    if definition.recurring is None and any(
        isinstance(p, Metered) for p in definition.prices
    ):
        raise ValueError(
            f'Product "{definition.id}" is a one-time purchase, so it can\'t have metered prices.'
        )
    wheres = [
        f'Price {i + 1} of product "{definition.id}"'
        for i in range(len(definition.prices))
    ]
    currencies: list[PresentmentCurrency] | None = None
    for price, where in zip(definition.prices, wheres, strict=True):
        own = price_currencies(price, where)
        if own is None:
            continue
        if currencies is None:
            currencies = own
        elif not same_currencies(own, currencies):
            raise ValueError(
                f"{where} must have amounts in the same currencies as the product's other prices "
                f"({', '.join(currencies)})."
            )
    return [
        config
        for price, where in zip(definition.prices, wheres, strict=True)
        for config in price_configs(
            price, currencies or [default_currency or "usd"], where
        )
    ]
