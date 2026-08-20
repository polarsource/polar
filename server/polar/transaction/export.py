from collections.abc import AsyncGenerator, Sequence
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Annotated
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import UUID4, AfterValidator

from polar.auth.models import AuthSubject, User
from polar.kit.csv import IterableCSVWriter
from polar.kit.db.postgres import AsyncReadSession
from polar.models import Transaction
from polar.models.transaction import PlatformFeeType, TransactionType

from .service.transaction import transaction as transaction_service


class TransactionExportColumn(StrEnum):
    created_at = "created_at"
    description = "description"
    gross_amount = "gross_amount"
    fees_amount = "fees_amount"
    tax_amount = "tax_amount"
    net_amount = "net_amount"
    status = "status"
    payout_date = "payout_date"
    currency = "currency"
    product = "product"
    customer_email = "customer_email"
    type = "type"


TRANSACTION_EXPORT_HEADERS: dict[TransactionExportColumn, str] = {
    TransactionExportColumn.created_at: "Date",
    TransactionExportColumn.description: "Description",
    TransactionExportColumn.gross_amount: "Gross",
    TransactionExportColumn.fees_amount: "Fees",
    TransactionExportColumn.tax_amount: "Tax",
    TransactionExportColumn.net_amount: "Net",
    TransactionExportColumn.status: "Status",
    TransactionExportColumn.payout_date: "Payout Date",
    TransactionExportColumn.currency: "Currency",
    TransactionExportColumn.product: "Product",
    TransactionExportColumn.customer_email: "Customer Email",
    TransactionExportColumn.type: "Type",
}

TRANSACTION_EXPORT_DEFAULT_COLUMNS: list[TransactionExportColumn] = [
    TransactionExportColumn.created_at,
    TransactionExportColumn.description,
    TransactionExportColumn.gross_amount,
    TransactionExportColumn.fees_amount,
    TransactionExportColumn.tax_amount,
    TransactionExportColumn.net_amount,
    TransactionExportColumn.status,
    TransactionExportColumn.payout_date,
]


def _validate_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except ValueError, ZoneInfoNotFoundError:
        raise ValueError(f"{value!r} is not a valid IANA time zone") from None
    return value


TransactionExportTimezone = Annotated[str, AfterValidator(_validate_timezone)]


def _datetime(value: datetime | None, tz: ZoneInfo) -> str | None:
    return value.astimezone(tz).isoformat() if value is not None else None


def _amount(value: int | None) -> float | None:
    return None if value is None else value / 100


def _description(transaction: Transaction) -> str:
    if transaction.order is not None:
        kind = "Subscription" if transaction.order.subscription_id else "Purchase"
        product_name = (
            transaction.order.product.name if transaction.order.product else None
        )
        return f"{kind} — {product_name}" if product_name else kind
    if transaction.issue_reward is not None:
        return f"Reward — {transaction.issue_reward.issue_reference}"
    if transaction.pledge is not None:
        return f"Pledge to {transaction.pledge.issue_reference}"
    if transaction.platform_fee_type is not None:
        if transaction.platform_fee_type == PlatformFeeType.platform:
            return "Polar fee"
        return f"Payment processor fee ({transaction.platform_fee_type})"
    if transaction.type == TransactionType.payout:
        return "Payout"
    return str(transaction.type)


def _status(transaction: Transaction, now: datetime) -> str:
    if transaction.payout_transaction_id is not None:
        return "Paid out"
    if transaction.type == TransactionType.payout:
        return "Available"
    delay: timedelta | None = (
        transaction.account.payout_transaction_delay if transaction.account else None
    )
    if delay is None or delay.total_seconds() == 0:
        return "Available"
    if transaction.created_at + delay <= now:
        return "Available"
    return "Pending"


def _payout_date(transaction: Transaction) -> datetime | None:
    payout_transaction = transaction.payout_transaction
    if payout_transaction is None:
        return None
    payout = payout_transaction.payout
    if payout is None:
        return None
    return payout.paid_at


def _product(transaction: Transaction) -> str | None:
    if transaction.order is None or transaction.order.product is None:
        return None
    return transaction.order.product.name


def _customer_email(transaction: Transaction) -> str | None:
    if transaction.order is not None:
        return transaction.order.customer.email
    payment = transaction.payment_transaction
    if payment is not None and payment.payment_customer is not None:
        return payment.payment_customer.email
    return None


def _row(
    transaction: Transaction, tz: ZoneInfo, now: datetime
) -> dict[TransactionExportColumn, str | float | None]:
    payment = transaction.payment_transaction
    gross = payment.amount + payment.tax_amount if payment is not None else None
    tax = -payment.tax_amount if payment is not None else None
    return {
        TransactionExportColumn.created_at: _datetime(transaction.created_at, tz),
        TransactionExportColumn.description: _description(transaction),
        TransactionExportColumn.gross_amount: _amount(gross),
        TransactionExportColumn.fees_amount: _amount(transaction.incurred_amount),
        TransactionExportColumn.tax_amount: _amount(tax),
        TransactionExportColumn.net_amount: _amount(transaction.net_amount),
        TransactionExportColumn.status: _status(transaction, now),
        TransactionExportColumn.payout_date: _datetime(_payout_date(transaction), tz),
        TransactionExportColumn.currency: transaction.currency,
        TransactionExportColumn.product: _product(transaction),
        TransactionExportColumn.customer_email: _customer_email(transaction),
        TransactionExportColumn.type: transaction.type,
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
    account_id: UUID4 | None,
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

    results = await transaction_service.export(
        session,
        auth_subject,
        type=type,
        account_id=account_id,
        exclude_platform_fees=exclude_platform_fees,
        created_after=created_after,
        created_before=created_before,
    )

    now = datetime.now(UTC)
    for transaction in results:
        row = _row(transaction, timezone, now)
        yield csv_writer.getrow(tuple(row[column] for column in export_columns))
