from enum import StrEnum
from typing import cast

from countryinfo import CountryInfo

# Currencies that Stripe treats as zero-decimal for payouts, even though they
# technically have smaller units. For these currencies, payout amounts must be
# in whole units (amounts in our internal representation must end with "00").
# See: https://docs.stripe.com/currencies#special-cases
STRIPE_PAYOUT_ZERO_DECIMAL_CURRENCIES: frozenset[str] = frozenset(
    {"isk", "huf", "twd", "ugx"}
)


def is_payout_zero_decimal_currency(currency: str) -> bool:
    """Check if a currency is treated as zero-decimal for Stripe payouts."""
    return currency.lower() in STRIPE_PAYOUT_ZERO_DECIMAL_CURRENCIES


def adjust_payout_amount_for_zero_decimal_currency(
    amount: int, currency: str
) -> tuple[int, int]:
    """Adjust a payout amount for zero-decimal currencies.

    For currencies like ISK, HUF, TWD, and UGX, Stripe requires payout amounts
    to be in whole units. This function rounds down the amount to the nearest
    valid value (multiple of 100 in our internal cents representation).

    Args:
        amount: The amount in smallest currency units (cents).
        currency: The currency code (e.g., "isk", "huf").

    Returns:
        A tuple of (adjusted_amount, remainder) where:
        - adjusted_amount: The amount rounded down to be valid for Stripe payouts
        - remainder: The amount that could not be paid out (0-99)
    """
    if not is_payout_zero_decimal_currency(currency):
        return amount, 0

    remainder = amount % 100
    adjusted_amount = amount - remainder
    return adjusted_amount, remainder


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
