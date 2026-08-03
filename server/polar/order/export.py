from collections.abc import AsyncGenerator, Sequence
from datetime import datetime
from enum import StrEnum
from typing import Annotated
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import AfterValidator

from polar.auth.models import AuthSubject, Organization, User
from polar.kit.csv import IterableCSVWriter
from polar.kit.db.postgres import AsyncReadSession
from polar.kit.pagination import PaginationParams
from polar.models import Order
from polar.models.order import OrderStatus
from polar.organization.schemas import OrganizationID
from polar.product.schemas import ProductID

from .service import order as order_service


class OrderExportColumn(StrEnum):
    email = "email"
    created_at = "created_at"
    product = "product"
    net_amount = "net_amount"
    currency = "currency"
    status = "status"
    invoice_number = "invoice_number"
    customer_name = "customer_name"
    billing_name = "billing_name"
    billing_country = "billing_country"
    subtotal_amount = "subtotal_amount"
    discount_amount = "discount_amount"
    tax_amount = "tax_amount"
    total_amount = "total_amount"
    refunded_amount = "refunded_amount"
    billing_reason = "billing_reason"


ORDER_EXPORT_HEADERS: dict[OrderExportColumn, str] = {
    OrderExportColumn.email: "Email",
    OrderExportColumn.created_at: "Created At",
    OrderExportColumn.product: "Product",
    OrderExportColumn.net_amount: "Net Amount",
    OrderExportColumn.currency: "Currency",
    OrderExportColumn.status: "Status",
    OrderExportColumn.invoice_number: "Invoice number",
    OrderExportColumn.customer_name: "Customer Name",
    OrderExportColumn.billing_name: "Billing Name",
    OrderExportColumn.billing_country: "Billing Country",
    OrderExportColumn.subtotal_amount: "Subtotal",
    OrderExportColumn.discount_amount: "Discount",
    OrderExportColumn.tax_amount: "Tax",
    OrderExportColumn.total_amount: "Total",
    OrderExportColumn.refunded_amount: "Refunded Amount",
    OrderExportColumn.billing_reason: "Billing Reason",
}

ORDER_EXPORT_DEFAULT_COLUMNS: list[OrderExportColumn] = [
    OrderExportColumn.email,
    OrderExportColumn.created_at,
    OrderExportColumn.product,
    OrderExportColumn.net_amount,
    OrderExportColumn.currency,
    OrderExportColumn.status,
    OrderExportColumn.invoice_number,
]


def _validate_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except (ValueError, ZoneInfoNotFoundError):
        raise ValueError(f"{value!r} is not a valid IANA time zone") from None
    return value


# Kept as a plain string rather than an enum of every IANA zone: the generated
# TypeScript client inlines such an enum at every use site, adding ~1200 lines.
OrderExportTimezone = Annotated[str, AfterValidator(_validate_timezone)]


def _row(order: Order, tz: ZoneInfo) -> dict[OrderExportColumn, str | float | None]:
    return {
        OrderExportColumn.email: order.customer.email,
        OrderExportColumn.created_at: order.created_at.astimezone(tz).isoformat(),
        OrderExportColumn.product: order.description,
        OrderExportColumn.net_amount: order.net_amount / 100,
        OrderExportColumn.currency: order.currency,
        OrderExportColumn.status: order.status,
        OrderExportColumn.invoice_number: order.invoice_number,
        OrderExportColumn.customer_name: order.customer.name,
        OrderExportColumn.billing_name: order.billing_name,
        OrderExportColumn.billing_country: (
            order.billing_address.country if order.billing_address else None
        ),
        OrderExportColumn.subtotal_amount: order.subtotal_amount / 100,
        OrderExportColumn.discount_amount: order.discount_amount / 100,
        OrderExportColumn.tax_amount: order.tax_amount / 100,
        OrderExportColumn.total_amount: order.total_amount / 100,
        OrderExportColumn.refunded_amount: order.refunded_amount / 100,
        OrderExportColumn.billing_reason: order.billing_reason.to_public(),
    }


def get_filename(
    created_after: datetime | None,
    created_before: datetime | None,
    timezone: ZoneInfo,
) -> str:
    filename = "polar-orders"
    for bound in (created_after, created_before):
        if bound is not None:
            filename += f"-{bound.astimezone(timezone).strftime('%Y-%m-%d')}"
    return f"{filename}.csv"


async def generate_csv(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    *,
    organization_id: Sequence[OrganizationID] | None,
    product_id: Sequence[ProductID] | None,
    status: Sequence[OrderStatus] | None,
    created_after: datetime | None,
    created_before: datetime | None,
    timezone: ZoneInfo,
    columns: Sequence[OrderExportColumn] | None,
) -> AsyncGenerator[str, None]:
    export_columns = columns or ORDER_EXPORT_DEFAULT_COLUMNS

    csv_writer = IterableCSVWriter(dialect="excel")
    yield csv_writer.getrow(
        tuple(ORDER_EXPORT_HEADERS[column] for column in export_columns)
    )

    (results, _) = await order_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        product_id=product_id,
        status=status,
        created_after=created_after,
        created_before=created_before,
        pagination=PaginationParams(limit=1000000, page=1),
    )

    for order in results:
        row = _row(order, timezone)
        yield csv_writer.getrow(tuple(row[column] for column in export_columns))
