from collections.abc import AsyncGenerator, Sequence
from datetime import datetime, timedelta
from enum import StrEnum
from typing import cast
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import Select
from sqlalchemy.orm import selectinload

from polar.auth.models import AuthSubject, User
from polar.kit.csv import IterableCSVWriter
from polar.kit.currency import get_currency_decimal_factor
from polar.kit.db.postgres import AsyncReadSession
from polar.kit.utils import utc_now
from polar.models import Account, Order, Transaction
from polar.models.transaction import TransactionType

from .repository import TransactionRepository
from .service.transaction import transaction as transaction_service


class TransactionExportColumn(StrEnum):
    created_at = "created_at"
    type = "type"
    product = "product"
    gross_amount = "gross_amount"
    tax_amount = "tax_amount"
    fees = "fees"
    net_amount = "net_amount"
    currency = "currency"
    status = "status"
    paid_out_at = "paid_out_at"
    invoice_number = "invoice_number"
    order_id = "order_id"


TRANSACTION_EXPORT_HEADERS: dict[TransactionExportColumn, str] = {
    TransactionExportColumn.created_at: "Created At",
    TransactionExportColumn.type: "Type",
    TransactionExportColumn.product: "Product",
    TransactionExportColumn.gross_amount: "Gross",
    TransactionExportColumn.tax_amount: "Tax",
    TransactionExportColumn.fees: "Fees",
    TransactionExportColumn.net_amount: "Net",
    TransactionExportColumn.currency: "Currency",
    TransactionExportColumn.status: "Status",
    TransactionExportColumn.paid_out_at: "Paid Out At",
    TransactionExportColumn.invoice_number: "Invoice number",
    TransactionExportColumn.order_id: "Order ID",
}

TRANSACTION_EXPORT_DEFAULT_COLUMNS: list[TransactionExportColumn] = [
    TransactionExportColumn.created_at,
    TransactionExportColumn.type,
    TransactionExportColumn.product,
    TransactionExportColumn.gross_amount,
    TransactionExportColumn.fees,
    TransactionExportColumn.tax_amount,
    TransactionExportColumn.net_amount,
    TransactionExportColumn.currency,
    TransactionExportColumn.status,
    TransactionExportColumn.paid_out_at,
]


def _description_type(transaction: Transaction) -> str:
    if transaction.order is not None:
        if transaction.order.subscription_id:
            return "Subscription"
        return "Purchase"
    if transaction.issue_reward is not None:
        return "Reward"
    if transaction.pledge is not None:
        return "Pledge"
    if transaction.type == TransactionType.payout:
        return "Payout"
    return transaction.type


def _status(transaction: Transaction, now: datetime, delay: timedelta | None) -> str:
    if transaction.payout_transaction_id:
        return "paid_out"
    if transaction.type == TransactionType.payout:
        return "available"
    if not delay:
        return "available"
    available_at = transaction.created_at + delay
    if available_at <= now:
        return "available"
    return "pending"


def _datetime(value: datetime | None, tz: ZoneInfo) -> str | None:
    return value.astimezone(tz).isoformat() if value is not None else None


def _paid_out_at(transaction: Transaction, tz: ZoneInfo) -> str | None:
    payout = transaction.payout_transaction
    if payout is None:
        return None
    return _datetime(payout.created_at, tz)


def _row(
    transaction: Transaction,
    tz: ZoneInfo,
    now: datetime,
    delay: timedelta | None,
) -> dict[TransactionExportColumn, str | float | None]:
    order = transaction.order
    payment = transaction.payment_transaction
    factor = get_currency_decimal_factor(transaction.currency)
    if payment is not None:
        payment_factor = get_currency_decimal_factor(payment.currency)
        gross_amount = (payment.amount + payment.tax_amount) / payment_factor
        tax_amount = -payment.tax_amount / payment_factor
    else:
        gross_amount = None
        tax_amount = None
    return {
        TransactionExportColumn.created_at: _datetime(transaction.created_at, tz),
        TransactionExportColumn.type: _description_type(transaction),
        TransactionExportColumn.product: (
            order.product.name
            if order is not None and order.product is not None
            else None
        ),
        TransactionExportColumn.gross_amount: gross_amount,
        TransactionExportColumn.tax_amount: tax_amount,
        TransactionExportColumn.fees: transaction.incurred_amount / factor,
        TransactionExportColumn.net_amount: transaction.net_amount / factor,
        TransactionExportColumn.currency: transaction.currency,
        TransactionExportColumn.status: _status(transaction, now, delay),
        TransactionExportColumn.paid_out_at: _paid_out_at(transaction, tz),
        TransactionExportColumn.invoice_number: (
            order.invoice_number if order is not None else None
        ),
        TransactionExportColumn.order_id: str(order.id) if order is not None else None,
    }


def get_filename(
    created_after: datetime | None,
    created_before: datetime | None,
    timezone: ZoneInfo,
) -> str:
    filename = "polar-income"
    for bound in (created_after, created_before):
        if bound is not None:
            filename += f"-{bound.astimezone(timezone).strftime('%Y-%m-%d')}"
    return f"{filename}.csv"


async def generate_csv(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User],
    *,
    type: TransactionType | None,
    account_id: UUID | None,
    exclude_platform_fees: bool,
    created_after: datetime | None,
    created_before: datetime | None,
    timezone: ZoneInfo,
    columns: Sequence[TransactionExportColumn] | None,
) -> AsyncGenerator[str]:
    export_columns = columns or TRANSACTION_EXPORT_DEFAULT_COLUMNS

    csv_writer = IterableCSVWriter(dialect="excel")
    yield csv_writer.getrow(
        tuple(TRANSACTION_EXPORT_HEADERS[column] for column in export_columns)
    )

    delay: timedelta | None = None
    if account_id is not None:
        account = await session.get(Account, account_id)
        if account is not None:
            delay = account.payout_transaction_delay

    now = utc_now()
    statement = cast(
        Select[tuple[Transaction]],
        transaction_service._get_readable_transactions_statement(auth_subject),
    ).options(
        selectinload(Transaction.account_incurred_transactions),
        selectinload(Transaction.pledge),
        selectinload(Transaction.issue_reward),
        selectinload(Transaction.order).selectinload(Order.product),
        selectinload(Transaction.payment_transaction),
        selectinload(Transaction.payout_transaction),
    )
    if type is not None:
        statement = statement.where(Transaction.type == type)
    if account_id is not None:
        statement = statement.where(Transaction.account_id == account_id)
    if exclude_platform_fees:
        statement = statement.where(Transaction.platform_fee_type.is_(None))
    if created_after is not None:
        statement = statement.where(Transaction.created_at >= created_after)
    if created_before is not None:
        statement = statement.where(Transaction.created_at <= created_before)
    statement = statement.distinct().order_by(Transaction.created_at.desc())

    repository = TransactionRepository.from_session(session)
    async for transaction in repository.stream(statement):
        row = _row(transaction, timezone, now, delay)
        yield csv_writer.getrow(tuple(row[column] for column in export_columns))
