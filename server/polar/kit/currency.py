from enum import StrEnum
from typing import cast

from countryinfo import CountryInfo


class PresentmentCurrency(StrEnum):
    usd = "usd"
    eur = "eur"
    gbp = "gbp"
    cad = "cad"
    aud = "aud"
    jpy = "jpy"
    chf = "chf"
    sek = "sek"


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
