import collections.abc
import dataclasses
import itertools
import typing

from polar.config.meters import Meter
from polar.config.money import Money, unit_amount
from polar.{{ latest }}.inputs import ConfigProductPrice, TierInput, TiersInput
from polar.{{ latest }}.literals import PresentmentCurrency, TaxBehaviorOption, TierType

Amounts: typing.TypeAlias = Money | collections.abc.Sequence[Money]
Structure: typing.TypeAlias = typing.Literal["flat", "volume", "graduated"]


@dataclasses.dataclass(frozen=True, kw_only=True)
class Tier:
    """A pricing tier up to `max` units; the last tier leaves `max` out.

    `amount` is the per-unit price in each currency. Without one the tier is free.
    `included=n` makes the first n units free in graduated pricing.
    """

    amount: Amounts | None = None
    max: int | None = None
    included: int | None = None

    def __post_init__(self) -> None:
        if self.included is not None and (
            self.amount is not None or self.max is not None
        ):
            raise ValueError(
                "Tier(included=...) takes no amount or max: those units are free."
            )

    @property
    def bound(self) -> int | None:
        return self.included if self.included is not None else self.max

    @property
    def amounts(self) -> tuple[Money, ...]:
        return _amounts(self.amount)


@dataclasses.dataclass(frozen=True, kw_only=True)
class Price:
    tax: TaxBehaviorOption | None = None


@dataclasses.dataclass(frozen=True, kw_only=True)
class Free(Price):
    """A fixed price of 0 in each currency the product's other prices use (USD when there are none)."""


@dataclasses.dataclass(frozen=True, kw_only=True)
class Fixed(Price):
    """A fixed price: `Fixed(usd(29))`, or `Fixed([usd(29), eur(27)])` for several currencies."""

    amount: Amounts = dataclasses.field(kw_only=False)

    @property
    def amounts(self) -> tuple[Money, ...]:
        return _amounts(self.amount)


@dataclasses.dataclass(frozen=True, kw_only=True)
class Tiered(Price):
    """A price that is a flat `amount` per unit, or `graduated` or `volume` tiers."""

    amount: Amounts | None = None
    graduated: collections.abc.Sequence[Tier] | None = None
    volume: collections.abc.Sequence[Tier] | None = None

    def __post_init__(self) -> None:
        given = [self.amount, self.graduated, self.volume]
        if sum(value is not None for value in given) != 1:
            raise ValueError(
                f"{type(self).__name__}() takes amount, graduated or volume, exactly one of them."
            )
        if self.volume is not None and any(
            tier.included is not None for tier in self.volume
        ):
            raise ValueError(
                "Volume pricing charges every unit at its tier rate, so it has no included units. "
                "Use graduated=[...] or Tier(max=n) without an amount."
            )

    @property
    def structure(self) -> Structure:
        if self.amount is not None:
            return "flat"
        return "graduated" if self.graduated is not None else "volume"

    @property
    def tiers(self) -> tuple[Tier, ...]:
        if self.amount is not None:
            return (Tier(amount=self.amount),)
        return tuple(
            self.graduated if self.graduated is not None else self.volume or ()
        )


@dataclasses.dataclass(frozen=True, kw_only=True)
class Seats(Tiered):
    """Per-seat pricing: `Seats(usd(10))`, or `graduated`/`volume` tiers, with `min`/`max` seats."""

    amount: Amounts | None = dataclasses.field(default=None, kw_only=False)
    min: int | None = None
    max: int | None = None


@dataclasses.dataclass(frozen=True, kw_only=True)
class Units(Seats):
    """Per-unit pricing, with `label=("server", "servers")` naming the unit at checkout."""

    label: tuple[str, str] | None = None


@dataclasses.dataclass(frozen=True, kw_only=True)
class Metered(Tiered):
    """Usage pricing on a meter: `Metered(Meters.tool_call, amount=per_thousand(usd(1)))`,
    or `graduated`/`volume` tiers. `cap` is the most a billing cycle charges, per currency."""

    meter: Meter = dataclasses.field(kw_only=False)
    cap: Amounts | None = None

    @property
    def caps(self) -> tuple[Money, ...]:
        return _amounts(self.cap)


def same_currencies(a: list[PresentmentCurrency], b: list[PresentmentCurrency]) -> bool:
    return set(a) == set(b) and len(a) == len(b)


def price_currencies(price: Price, where: str) -> list[PresentmentCurrency] | None:
    """The currencies a price is set in, after checking every tier and cap uses the same ones."""
    if isinstance(price, Free):
        return None
    if isinstance(price, Fixed):
        return _currencies_of(price.amounts, where)
    assert isinstance(price, Tiered)
    currencies: list[PresentmentCurrency] | None = None
    for index, current in enumerate(price.tiers):
        if not current.amounts:
            continue
        tier_where = f"{where} tier {index + 1}"
        own = _currencies_of(current.amounts, tier_where)
        if currencies is None:
            currencies = own
        elif not same_currencies(own, currencies):
            raise ValueError(
                f"{tier_where} must have amounts in the same currencies as the price's "
                f"other tiers ({', '.join(currencies)})."
            )
    if currencies is None:
        if isinstance(price, Metered) and price.caps:
            raise ValueError(f"{where} has a cap, but every tier is free.")
        return None
    if isinstance(price, Metered) and price.caps:
        unknown = [
            c for c in _currencies_of(price.caps, f"{where} cap") if c not in currencies
        ]
        if unknown:
            raise ValueError(
                f"{where} has a cap in {', '.join(unknown)}, which it has no amounts in."
            )
    return currencies


def price_configs(
    price: Price, currencies: list[PresentmentCurrency], where: str
) -> list[ConfigProductPrice]:
    """Expands a price into one API price per currency."""
    return [_price_config(price, currency, where) for currency in currencies]


def _amounts(amounts: Amounts | None) -> tuple[Money, ...]:
    if amounts is None:
        return ()
    return (amounts,) if isinstance(amounts, Money) else tuple(amounts)


def _currencies_of(amounts: tuple[Money, ...], where: str) -> list[PresentmentCurrency]:
    currencies = [money.currency for money in amounts]
    if not currencies:
        raise ValueError(f"{where} needs at least one amount.")
    if len(set(currencies)) != len(currencies):
        raise ValueError(f"{where} lists the same currency more than once.")
    return currencies


def _amount_in(amounts: tuple[Money, ...], currency: PresentmentCurrency) -> Money:
    for money in amounts:
        if money.currency == currency:
            return money
    raise ValueError(f"Missing an amount in {currency}.")


def _bounds(
    tiers: tuple[Tier, ...], maximum: int | None, where: str
) -> list[int | None]:
    bounds = [current.bound for current in tiers]
    if maximum is not None:
        if bounds[-1] is not None:
            raise ValueError(
                f"{where} can't set max when its last tier already has one."
            )
        bounds[-1] = maximum
    for previous, current in itertools.pairwise(bounds):
        if previous is None:
            raise ValueError(f"{where} can only leave its last tier without a max.")
        if current is not None and current <= previous:
            raise ValueError(
                f"{where} needs increasing tier bounds, got {current} after {previous}."
            )
    return bounds


def _tiers_input(
    type: TierType,
    tiers: tuple[Tier, ...],
    bounds: list[int | None],
    currency: PresentmentCurrency,
) -> TiersInput:
    inputs: list[TierInput] = []
    for current, bound in zip(tiers, bounds, strict=True):
        amount = (
            "0"
            if not current.amounts
            else unit_amount(_amount_in(current.amounts, currency))
        )
        entry = TierInput(unit_amount=amount)
        if bound is not None:
            entry["bound"] = bound
        inputs.append(entry)
    return TiersInput(type=type, tiers=inputs)


def _price_config(
    price: Price, currency: PresentmentCurrency, where: str
) -> ConfigProductPrice:
    fields: dict[str, typing.Any] = {"price_currency": currency}
    if price.tax is not None:
        fields["tax_behavior"] = price.tax
    if isinstance(price, Free):
        fields.update(amount_type="fixed", price_amount=0)
    elif isinstance(price, Fixed):
        fields.update(
            amount_type="fixed", price_amount=_amount_in(price.amounts, currency).amount
        )
    elif isinstance(price, Seats):
        structure: TierType = (
            "graduated" if price.structure == "graduated" else "volume"
        )
        bounds = _bounds(price.tiers, price.max, where)
        fields.update(
            amount_type="unit_based" if isinstance(price, Units) else "seat_based",
            tiers=_tiers_input(structure, price.tiers, bounds, currency),
        )
        if price.min is not None:
            fields["minimum_units"] = price.min
        if isinstance(price, Units) and price.label is not None:
            singular, plural = price.label
            fields["unit_label"] = {"en": {"=1": singular, "other": plural}}
    else:
        assert isinstance(price, Metered)
        fields["meter"] = price.meter.id
        cap = next((money for money in price.caps if money.currency == currency), None)
        if cap is not None:
            fields["cap_amount"] = cap.amount
        if price.structure == "flat":
            fields.update(
                amount_type="metered_unit",
                unit_amount=unit_amount(_amount_in(price.tiers[0].amounts, currency)),
            )
        else:
            bounds = _bounds(price.tiers, None, where)
            if bounds[-1] is not None:
                raise ValueError(
                    f"{where} must leave its last tier without a max, since usage has no upper limit."
                )
            fields.update(
                amount_type="metered_tiers",
                tiers=_tiers_input(price.structure, price.tiers, bounds, currency),
            )
    return typing.cast(ConfigProductPrice, fields)
