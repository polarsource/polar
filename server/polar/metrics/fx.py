from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    ColumnElement,
    Numeric,
    Select,
    func,
    literal_column,
    select,
    union_all,
)
from sqlalchemy.orm import InstrumentedAttribute

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
        Transaction.type == literal_column(f"'{TransactionType.payment}'"),
        Transaction.presentment_currency.is_not(None),
        func.lower(Transaction.currency) == literal_column("'usd'"),
    )


def recorded_exchange_rate_clauses() -> tuple[ColumnElement[bool], ...]:
    return (*usd_settled_payment_clauses(), Transaction.exchange_rate.is_not(None))


def closest_recorded_exchange_rate(
    currency: ColumnElement[str],
    timestamp: ColumnElement[datetime] | InstrumentedAttribute[datetime],
) -> Select[tuple[Decimal]]:
    candidates = select(
        recorded_exchange_rate().label("rate"),
        Transaction.created_at.label("created_at"),
    ).where(
        *recorded_exchange_rate_clauses(),
        func.lower(Transaction.presentment_currency) == currency,
    )
    before = (
        candidates.where(Transaction.created_at <= timestamp)
        .order_by(Transaction.created_at.desc())
        .limit(1)
        .correlate_except(Transaction)
    )
    after = (
        candidates.where(Transaction.created_at > timestamp)
        .order_by(Transaction.created_at.asc())
        .limit(1)
        .correlate_except(Transaction)
    )
    closest = union_all(before, after).subquery("closest")
    return (
        select(closest.c.rate)
        .order_by(
            func.abs(func.extract("epoch", closest.c.created_at - timestamp)),
            closest.c.created_at,
        )
        .limit(1)
    )
