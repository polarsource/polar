from enum import StrEnum
from typing import TYPE_CHECKING, cast

from countryinfo import CountryInfo

from polar.config import settings

if TYPE_CHECKING or settings.is_development() or settings.is_testing():

    class PresentmentCurrency(StrEnum):
        aud = "aud"
        cad = "cad"
        chf = "chf"
        eur = "eur"
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
