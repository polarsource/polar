import csv
import math
from pathlib import Path
from typing import TypedDict


class CountryFees(TypedDict):
    currency: str
    account_fee: int
    transfer_fee_percentage: float
    payout_fee_flat: int
    payout_fee_percentage: float


def _load_country_fees() -> dict[str, CountryFees]:
    country_fees = {}
    with open(Path(__file__).parent / "stripe_country_fees.csv") as file:
        reader = csv.DictReader(file)
        for row in reader:
            country = row["country"]
            fees = CountryFees(
                currency=row["currency"].lower(),
                account_fee=int(row["account_fee"]),
                transfer_fee_percentage=float(row["transfer_fee_percentage"]),
                payout_fee_flat=int(row["payout_fee_flat"]),
                payout_fee_percentage=float(row["payout_fee_percentage"]),
            )
            country_fees[country] = fees

    return country_fees


country_fees = _load_country_fees()
us_fees = country_fees["US"]


def round_stripe(amount: float) -> int:
    return math.ceil(amount) if amount - int(amount) >= 0.5 else math.floor(amount)


def get_stripe_subscription_fee(amount: int) -> int:
    return round_stripe(amount * 0.005)


def get_stripe_invoice_fee(amount: int) -> int:
    return round_stripe(amount * 0.005)


def get_stripe_account_fee() -> int:
    """
    Account fees vary per country, as per the data in `country_fees`.

    However, for simplicity now, we will assume that the account fee
    are the same as the US fees.
    """
    return us_fees["account_fee"]


def get_reverse_stripe_payout_fees(amount: int, country: str) -> tuple[int, int]:
    fees = country_fees.get(country, us_fees)
    p1 = fees["transfer_fee_percentage"]

    # Assume for simplicity that the payout fee is the same as the US fees
    p2 = us_fees["payout_fee_percentage"]
    f2 = us_fees["payout_fee_flat"]

    # Ref: https://www.wolframalpha.com/input?i=x+%2B+%28x*p_1%29+%2B+%28x+-+%28x*p_1%29%29+*+p_2+%2B+f_2+%3D+t
    reversed_amount = math.floor((f2 - amount) / (p2 * p1 - p1 - p2 - 1))

    if reversed_amount <= 0:
        raise ValueError("Fees are higher than the amount to be paid out.")

    transfer_fee = round_stripe(reversed_amount * p1)
    payout_fee = amount - reversed_amount - transfer_fee

    return transfer_fee, payout_fee


__all__ = [
    "round_stripe",
    "get_stripe_subscription_fee",
    "get_stripe_invoice_fee",
    "get_stripe_account_fee",
    "get_reverse_stripe_payout_fees",
]
