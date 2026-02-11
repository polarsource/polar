from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING, cast

from babel.numbers import format_currency as _format_currency
from countryinfo import CountryInfo

from polar.config import settings

if TYPE_CHECKING or settings.is_development() or settings.is_testing():

    class PresentmentCurrency(StrEnum):
        aud = "aud"
        brl = "brl"
        cad = "cad"
        chf = "chf"
        eur = "eur"
        inr = "inr"
        gbp = "gbp"
        jpy = "jpy"
        sek = "sek"
        usd = "usd"
else:
    # For now, only USD is supported in production
    class PresentmentCurrency(StrEnum):
        usd = "usd"


def get_presentment_currency(country: str) -> PresentmentCurrency | None:
    """Get the presentment currency for a given country.

    Args:
        country: The country code (ISO 3166-1 alpha-2).

    Returns:
        The presentment currency or None if no supported currency is found.
    """
    try:
        countryinfo = CountryInfo(country)
        currencies = cast(list[str], countryinfo.currencies())
    except KeyError:
        return None
    else:
        for currency in currencies:
            try:
                return PresentmentCurrency(currency.lower())
            except ValueError:
                continue
        return None


_ZERO_DECIMAL_CURRENCIES: set[str] = {
    "bif",
    "clp",
    "djf",
    "gnf",
    "jpy",
    "kmf",
    "krw",
    "mga",
    "pyg",
    "rwf",
    "ugx",
    "vnd",
    "vuv",
    "xaf",
    "xof",
    "xpf",
}


def _get_currency_decimal_factor(currency: PresentmentCurrency | str) -> int:
    """Get the decimal factor for a given currency.

    Args:
        currency: The currency code.

    Returns:
        The decimal factor (e.g., 100 for usd, 1 for jpy).
    """
    if currency.lower() in _ZERO_DECIMAL_CURRENCIES:
        return 1
    else:
        return 100


def format_currency(
    amount: int | Decimal | float,
    currency: PresentmentCurrency | str,
    decimal_quantization: bool = True,
) -> str:
    """Format the currency amount.

    Handles conversion from smallest currency unit (e.g., cents) to major unit.

    Args:
        amount: The amount in the smallest currency unit (e.g., cents).
        currency: The currency code.
        decimal_quantization: Truncate and round high-precision numbers to the format pattern.

    Returns:
        The formatted currency string.
    """
    return _format_currency(
        amount / _get_currency_decimal_factor(currency),
        currency.upper(),
        locale="en_US",
        decimal_quantization=decimal_quantization,
    )
