"""Billing config for the Polar CLI.

Declare settings, meters, benefits, products and webhooks as attributes of `SettingsSet`,
`MeterSet`, `BenefitSet`, `ProductSet` and `WebhookSet` subclasses in `polarfile.py`, and
pass the classes to `Config(...)` assigned to a variable named `config`. `polar config plan` and
`polar config apply` read it by running `python -m polar.config polarfile.py`.
"""

from polar.config.benefits import Benefit, BenefitSet, Credits, Flag
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
from polar.config.products import Product, ProductSet
from polar.config.settings import PaymentSettings, SettingsSet
from polar.config.webhooks import Webhook, WebhookSet

__all__ = [
    "Benefit",
    "BenefitSet",
    "Config",
    "Credits",
    "Fixed",
    "Flag",
    "Free",
    "Meter",
    "MeterSet",
    "Metered",
    "Money",
    "PaymentSettings",
    "Price",
    "Product",
    "ProductSet",
    "Seats",
    "SettingsSet",
    "Tier",
    "Tiered",
    "Units",
    "Webhook",
    "WebhookSet",
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
