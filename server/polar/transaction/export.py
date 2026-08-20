from collections.abc import AsyncGenerator, Sequence
from datetime import datetime, timedelta
from enum import StrEnum
from typing import Annotated
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import AfterValidator

from polar.auth.models import AuthSubject, User
from polar.kit.csv import IterableCSVWriter
from polar.kit.db.postgres import AsyncReadSession
from polar.kit.pagination import PaginationParams
from polar.kit.utils import utc_now
from polar.models import Account, Transaction
from polar.models.transaction import TransactionType

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


def _validate_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except ValueError, ZoneInfoNotFoundError:
        raise ValueError(f"{value!r} is not a valid IANA time zone") from None
    return value


# Kept as a plain string rather than an enum of every IANA zone: the generated
# TypeScript client inlines such an enum at every use site, adding ~1200 lines.
TransactionExportTimezone = Annotated[str, AfterValidator(_validate_timezone)]


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


def _cents(value: int) -> float:
    return value / 100


def _row(
    transaction: Transaction,
    tz: ZoneInfo,
    now: datetime,
    delay: timedelta | None,
) -> dict[TransactionExportColumn, str | float | None]:
    order = transaction.order
    payment = transaction.payment_transaction
    return {
        TransactionExportColumn.created_at: _datetime(transaction.created_at, tz),
        TransactionExportColumn.type: _description_type(transaction),
        TransactionExportColumn.product: (
            order.product.name
            if order is not None and order.product is not None
            else None
        ),
        TransactionExportColumn.gross_amount: (
            _cents(payment.amount + payment.tax_amount) if payment is not None else None
        ),
        TransactionExportColumn.tax_amount: (
            _cents(-payment.tax_amount) if payment is not None else None
        ),
        TransactionExportColumn.fees: _cents(transaction.incurred_amount),
        TransactionExportColumn.net_amount: _cents(transaction.net_amount),
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

    (results, _) = await transaction_service.search(
        session,
        auth_subject,
        type=type,
        account_id=account_id,
        exclude_platform_fees=exclude_platform_fees,
        created_after=created_after,
        created_before=created_before,
        include_payout_transactions=True,
        pagination=PaginationParams(limit=1000000, page=1),
    )

    now = utc_now()
    for transaction in results:
        row = _row(transaction, timezone, now, delay)
        yield csv_writer.getrow(tuple(row[column] for column in export_columns))
