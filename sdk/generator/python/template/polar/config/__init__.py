"""Billing config for the Polar CLI.

Declare meters as attributes of a `MeterSet` subclass in `polarfile.py`, and pass the
class to `Config(...)` assigned to a variable named `config`. `polar config plan` and
`polar config apply` read it by running `python -m polar.config polarfile.py`.
"""

from polar.config.config import Config
from polar.config.meters import (
    Meter,
    MeterSet,
    and_,
    eq,
    gt,
    gte,
    like,
    lt,
    lte,
    ne,
    not_like,
    or_,
)
from polar.config.money import (
    Money,
    aud,
    brl,
    cad,
    chf,
    currency,
    eur,
    gbp,
    ils,
    inr,
    jpy,
    krw,
    lira,
    per,
    per_million,
    per_thousand,
    usd,
)
from polar.config.prices import Fixed, Free, Metered, Price, Seats, Tier, Tiered, Units

__all__ = [
    "Config",
    "Fixed",
    "Free",
    "Meter",
    "MeterSet",
    "Metered",
    "Money",
    "Price",
    "Seats",
    "Tier",
    "Tiered",
    "Units",
    "and_",
    "aud",
    "brl",
    "cad",
    "chf",
    "currency",
    "eq",
    "eur",
    "gbp",
    "gt",
    "gte",
    "ils",
    "inr",
    "jpy",
    "krw",
    "like",
    "lira",
    "lt",
    "lte",
    "ne",
    "not_like",
    "or_",
    "per",
    "per_million",
    "per_thousand",
    "usd",
]
