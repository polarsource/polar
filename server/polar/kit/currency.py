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


def get_presentment_currency(
    country: str, default: PresentmentCurrency
) -> PresentmentCurrency:
    """Get the presentment currency for a given country.

    Args:
        country (str): The country code (ISO 3166-1 alpha-2).
        default (PresentmentCurrency): The default currency to return if no supported currency is found.

    Returns:
        PresentmentCurrency: A supported presentment currency code (ISO 4217).
    """
    try:
        countryinfo = CountryInfo(country)
        currencies = cast(list[str], countryinfo.currencies())
    except KeyError:
        return default
    else:
        for currency in currencies:
            try:
                return PresentmentCurrency(currency.lower())
            except ValueError:
                continue
        return default
