from datetime import datetime
from decimal import Decimal

from sqlalchemy import CTE, ColumnElement, Numeric, Select, func, select

from polar.models import Transaction
from polar.models.transaction import TransactionType


def payment_exchange_rate() -> ColumnElement[Decimal]:
    return func.coalesce(
        func.nullif(func.cast(Transaction.exchange_rate, Numeric(30, 12)), 0),
        func.cast(Transaction.amount, Numeric(30, 12))
        / func.nullif(func.cast(Transaction.presentment_amount, Numeric(30, 12)), 0),
    )


def recorded_exchange_rate() -> ColumnElement[Decimal]:
    return func.cast(Transaction.exchange_rate, Numeric(30, 12))


def usd_settled_payment_clauses() -> tuple[ColumnElement[bool], ...]:
    return (
        Transaction.type == TransactionType.payment,
        Transaction.presentment_currency.is_not(None),
        func.lower(Transaction.currency) == "usd",
    )


def recorded_exchange_rate_clauses() -> tuple[ColumnElement[bool], ...]:
    """Payments whose processor-recorded rate converts to USD.

    Reference rates applied to other orders only use these: a rate derived
    from amounts is skewed by rounding, and a non-USD settlement's rate is
    not a USD rate.
    """
    return (*usd_settled_payment_clauses(), Transaction.exchange_rate > 0)


def global_daily_exchange_rates() -> Select[tuple[datetime, str, Decimal]]:
    day = func.date_trunc("day", Transaction.created_at)
    currency = func.lower(Transaction.presentment_currency)
    return (
        select(
            day.label("day"),
            currency.label("currency"),
            func.avg(recorded_exchange_rate()).label("rate"),
        )
        .where(*recorded_exchange_rate_clauses())
        .group_by(day, currency)
    )


def closest_global_daily_rate(
    daily_rates: CTE,
    currency: ColumnElement[str],
    day: ColumnElement[datetime],
) -> Select[tuple[Decimal]]:
    return (
        select(daily_rates.c.rate)
        .where(
            daily_rates.c.currency == currency,
            daily_rates.c.rate.is_not(None),
        )
        .order_by(func.abs(func.extract("epoch", daily_rates.c.day - day)))
        .limit(1)
    )
