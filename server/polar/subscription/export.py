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
from polar.models import Subscription
from polar.models.subscription import SubscriptionStatus
from polar.organization.schemas import OrganizationID
from polar.product.schemas import ProductID

from .service import subscription as subscription_service


class SubscriptionExportColumn(StrEnum):
    email = "email"
    started_at = "started_at"
    product = "product"
    amount = "amount"
    currency = "currency"
    status = "status"
    recurring_interval = "recurring_interval"
    customer_name = "customer_name"
    billing_name = "billing_name"
    billing_country = "billing_country"
    net_amount = "net_amount"
    discount = "discount"
    seats = "seats"
    current_period_start = "current_period_start"
    current_period_end = "current_period_end"
    cancel_at_period_end = "cancel_at_period_end"
    canceled_at = "canceled_at"
    ends_at = "ends_at"
    ended_at = "ended_at"
    cancellation_reason = "cancellation_reason"
    trial_start = "trial_start"
    trial_end = "trial_end"


SUBSCRIPTION_EXPORT_HEADERS: dict[SubscriptionExportColumn, str] = {
    SubscriptionExportColumn.email: "Email",
    SubscriptionExportColumn.started_at: "Started At",
    SubscriptionExportColumn.product: "Product",
    SubscriptionExportColumn.amount: "Amount",
    SubscriptionExportColumn.currency: "Currency",
    SubscriptionExportColumn.status: "Status",
    SubscriptionExportColumn.recurring_interval: "Billing Interval",
    SubscriptionExportColumn.customer_name: "Customer Name",
    SubscriptionExportColumn.billing_name: "Billing Name",
    SubscriptionExportColumn.billing_country: "Billing Country",
    SubscriptionExportColumn.net_amount: "Net Amount",
    SubscriptionExportColumn.discount: "Discount",
    SubscriptionExportColumn.seats: "Seats",
    SubscriptionExportColumn.current_period_start: "Current Period Start",
    SubscriptionExportColumn.current_period_end: "Current Period End",
    SubscriptionExportColumn.cancel_at_period_end: "Cancels At Period End",
    SubscriptionExportColumn.canceled_at: "Canceled At",
    SubscriptionExportColumn.ends_at: "Ends At",
    SubscriptionExportColumn.ended_at: "Ended At",
    SubscriptionExportColumn.cancellation_reason: "Cancellation Reason",
    SubscriptionExportColumn.trial_start: "Trial Start",
    SubscriptionExportColumn.trial_end: "Trial End",
}

SUBSCRIPTION_EXPORT_DEFAULT_COLUMNS: list[SubscriptionExportColumn] = [
    SubscriptionExportColumn.email,
    SubscriptionExportColumn.started_at,
    SubscriptionExportColumn.product,
    SubscriptionExportColumn.amount,
    SubscriptionExportColumn.currency,
    SubscriptionExportColumn.status,
    SubscriptionExportColumn.recurring_interval,
]


def _validate_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except ValueError, ZoneInfoNotFoundError:
        raise ValueError(f"{value!r} is not a valid IANA time zone") from None
    return value


SubscriptionExportTimezone = Annotated[str, AfterValidator(_validate_timezone)]


def _datetime(value: datetime | None, tz: ZoneInfo) -> str | None:
    return value.astimezone(tz).isoformat() if value is not None else None


def _interval(subscription: Subscription) -> str:
    if subscription.recurring_interval_count == 1:
        return subscription.recurring_interval
    return f"{subscription.recurring_interval_count} {subscription.recurring_interval}s"


def _row(
    subscription: Subscription, tz: ZoneInfo
) -> dict[SubscriptionExportColumn, str | float | None]:
    customer = subscription.customer
    discount = subscription.discount
    return {
        SubscriptionExportColumn.email: customer.email,
        SubscriptionExportColumn.started_at: _datetime(subscription.started_at, tz),
        SubscriptionExportColumn.product: subscription.product.name,
        SubscriptionExportColumn.amount: subscription.amount / 100,
        SubscriptionExportColumn.currency: subscription.currency,
        SubscriptionExportColumn.status: subscription.status,
        SubscriptionExportColumn.recurring_interval: _interval(subscription),
        SubscriptionExportColumn.customer_name: customer.name,
        SubscriptionExportColumn.billing_name: customer.billing_name,
        SubscriptionExportColumn.billing_country: (
            customer.billing_address.country if customer.billing_address else None
        ),
        SubscriptionExportColumn.net_amount: subscription.net_amount / 100,
        SubscriptionExportColumn.discount: (
            discount.code or discount.name if discount else None
        ),
        SubscriptionExportColumn.seats: subscription.seats,
        SubscriptionExportColumn.current_period_start: _datetime(
            subscription.current_period_start, tz
        ),
        SubscriptionExportColumn.current_period_end: _datetime(
            subscription.current_period_end, tz
        ),
        SubscriptionExportColumn.cancel_at_period_end: (
            "true" if subscription.cancel_at_period_end else "false"
        ),
        SubscriptionExportColumn.canceled_at: _datetime(subscription.canceled_at, tz),
        SubscriptionExportColumn.ends_at: _datetime(subscription.ends_at, tz),
        SubscriptionExportColumn.ended_at: _datetime(subscription.ended_at, tz),
        SubscriptionExportColumn.cancellation_reason: (
            subscription.customer_cancellation_reason
        ),
        SubscriptionExportColumn.trial_start: _datetime(subscription.trial_start, tz),
        SubscriptionExportColumn.trial_end: _datetime(subscription.trial_end, tz),
    }


def get_filename(
    started_after: datetime | None,
    started_before: datetime | None,
    timezone: ZoneInfo,
) -> str:
    filename = "polar-subscriptions"
    for bound in (started_after, started_before):
        if bound is not None:
            filename += f"-{bound.astimezone(timezone).strftime('%Y-%m-%d')}"
    return f"{filename}.csv"


async def generate_csv(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    *,
    organization_id: Sequence[OrganizationID] | None,
    product_id: Sequence[ProductID] | None,
    status: Sequence[SubscriptionStatus] | None,
    cancel_at_period_end: bool | None,
    started_after: datetime | None,
    started_before: datetime | None,
    timezone: ZoneInfo,
    columns: Sequence[SubscriptionExportColumn] | None,
) -> AsyncGenerator[str]:
    export_columns = columns or SUBSCRIPTION_EXPORT_DEFAULT_COLUMNS

    csv_writer = IterableCSVWriter(dialect="excel")
    yield csv_writer.getrow(
        tuple(SUBSCRIPTION_EXPORT_HEADERS[column] for column in export_columns)
    )

    (results, _) = await subscription_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        product_id=product_id,
        status=status,
        cancel_at_period_end=cancel_at_period_end,
        started_after=started_after,
        started_before=started_before,
        pagination=PaginationParams(limit=1000000, page=1),
    )

    for subscription in results:
        row = _row(subscription, timezone)
        yield csv_writer.getrow(tuple(row[column] for column in export_columns))
