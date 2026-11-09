import dataclasses
import decimal
import typing

from polar.{{ latest }}.literals import PresentmentCurrency

Amount: typing.TypeAlias = int | float | str | decimal.Decimal

MAX_PER = 10**12

ZERO_DECIMAL_CURRENCIES: frozenset[PresentmentCurrency] = frozenset(
    {
        "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga",
        "pyg", "rwf", "vnd", "vuv", "xaf", "xof", "xpf",
    }
)  # fmt: skip


def decimals_of(code: PresentmentCurrency) -> int:
    return 0 if code in ZERO_DECIMAL_CURRENCIES else 2


@dataclasses.dataclass(frozen=True)
class Money:
    """An amount in the currency's smallest unit, charged for every `per` units."""

    currency: PresentmentCurrency
    amount: int
    per: int = 1


def currency(code: PresentmentCurrency) -> typing.Callable[[Amount], Money]:
    """Amounts are in the currency's major unit: `usd(1)` is $1.00, `usd(0.5)` is $0.50."""
    decimals = decimals_of(code)

    def make(amount: Amount) -> Money:
        try:
            value = decimal.Decimal(str(amount))
        except decimal.InvalidOperation:
            value = decimal.Decimal("NaN")
        if (
            not value.is_finite()
            or value < 0
            or value != value.quantize(decimal.Decimal(1).scaleb(-decimals))
        ):
            unit = (
                "non-negative whole numbers"
                if decimals == 0
                else f"non-negative with at most {decimals} decimals"
            )
            raise ValueError(f"Amounts in {code} must be {unit}, got {code}({amount}).")
        return Money(code, int(value.scaleb(decimals)))

    return make


usd = currency("usd")
eur = currency("eur")
lira = currency("try")
gbp = currency("gbp")
ils = currency("ils")
inr = currency("inr")
aud = currency("aud")
cad = currency("cad")
jpy = currency("jpy")
chf = currency("chf")
krw = currency("krw")
brl = currency("brl")


def per(units: int, money: Money) -> Money:
    """Charges the amount for every `units` units, a power of ten up to 10^12."""
    if (
        units <= 1
        or units > MAX_PER
        or set(str(units)[1:]) - {"0"}
        or str(units)[0] != "1"
    ):
        raise ValueError(
            f"Amounts can only be charged per a power of ten up to 10^12, got {units}."
        )
    return dataclasses.replace(money, per=units)


def per_thousand(money: Money) -> Money:
    """Charges the amount for every thousand units: `per_thousand(usd(1))` is $1 per 1K."""
    return per(1_000, money)


def per_million(money: Money) -> Money:
    """Charges the amount for every million units: `per_million(usd(1))` is $1 per 1M."""
    return per(1_000_000, money)


def _shift(amount: int, decimals: int) -> str:
    digits = str(amount).rjust(decimals + 1, "0")
    whole, fraction = digits[: len(digits) - decimals], digits[len(digits) - decimals :]
    fraction = fraction.rstrip("0")
    return whole if fraction == "" else f"{whole}.{fraction}"


def unit_amount(money: Money) -> str:
    """The per-unit rate as a decimal string, so sub-cent rates keep their precision."""
    return _shift(money.amount, len(str(money.per)) - 1)
