from decimal import Decimal
from enum import StrEnum

from babel.numbers import format_currency as _format_currency
from babel.numbers import get_territory_currencies


class PresentmentCurrency(StrEnum):
    aed = "aed"
    ars = "ars"
    aud = "aud"
    brl = "brl"
    cad = "cad"
    chf = "chf"
    clp = "clp"
    cny = "cny"
    cop = "cop"
    czk = "czk"
    dkk = "dkk"
    eur = "eur"
    gbp = "gbp"
    hkd = "hkd"
    huf = "huf"
    idr = "idr"
    ils = "ils"
    inr = "inr"
    jpy = "jpy"
    krw = "krw"
    mxn = "mxn"
    myr = "myr"
    nok = "nok"
    nzd = "nzd"
    pen = "pen"
    php = "php"
    pln = "pln"
    ron = "ron"
    sar = "sar"
    sek = "sek"
    sgd = "sgd"
    thb = "thb"
    try_ = "try"
    twd = "twd"
    usd = "usd"
    zar = "zar"


def get_presentment_currency(country: str) -> PresentmentCurrency | None:
    """Get the presentment currency for a given country.

    Args:
        country: The country code (ISO 3166-1 alpha-2).

    Returns:
        The presentment currency or None if no supported currency is found.
    """
    try:
        currencies = get_territory_currencies(country)
    except Exception:
        return None
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
