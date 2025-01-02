import time
from datetime import UTC, datetime, timedelta
from typing import Any

import stripe as stripe_lib

from polar.models import (
    Customer,
    Discount,
    Organization,
    Subscription,
)
from polar.models.subscription import SubscriptionStatus


def cloned_stripe_canceled_subscription(
    subscription: Subscription,
    revoke: bool = False,
) -> stripe_lib.Subscription:
    return cloned_stripe_subscription(
        subscription,
        revoke=revoke,
        cancel_at_period_end=True,
    )


def cloned_stripe_subscription(
    subscription: Subscription,
    *,
    customer: Customer | None = None,
    price_id: str | None = None,
    status: SubscriptionStatus | None = None,
    cancel_at_period_end: bool | None = None,
    revoke: bool = False,
) -> stripe_lib.Subscription:
    if price_id is None:
        price_id = subscription.price.stripe_price_id

    if cancel_at_period_end is None:
        cancel_at_period_end = subscription.cancel_at_period_end

    return construct_stripe_subscription(
        customer=customer if customer else subscription.customer,
        price_id=price_id,
        status=status if status else subscription.status,
        cancel_at_period_end=cancel_at_period_end,
        revoke=revoke,
    )


def construct_stripe_subscription(
    *,
    customer: Customer | None = None,
    organization: Organization | None = None,
    price_id: str = "PRICE_ID",
    status: SubscriptionStatus = SubscriptionStatus.incomplete,
    latest_invoice: stripe_lib.Invoice | None = None,
    cancel_at_period_end: bool = False,
    metadata: dict[str, str] = {},
    discount: Discount | None = None,
    revoke: bool = False,
) -> stripe_lib.Subscription:
    now_timestamp = datetime.now(UTC).timestamp()
    base_metadata: dict[str, str] = {
        **(
            {"organization_subscriber_id": str(organization.id)}
            if organization is not None
            else {}
        ),
    }

    canceled_at = None
    ended_at = None
    if revoke:
        ended_at = now_timestamp
        canceled_at = now_timestamp
        status = SubscriptionStatus.canceled
        cancel_at_period_end = False
    elif cancel_at_period_end:
        canceled_at = now_timestamp

    return stripe_lib.Subscription.construct_from(
        {
            "id": "SUBSCRIPTION_ID",
            "customer": (
                customer.stripe_customer_id if customer is not None else "CUSTOMER_ID"
            ),
            "status": status,
            "items": {
                "data": [
                    {"price": {"id": price_id, "currency": "USD", "unit_amount": 1000}}
                ]
            },
            "current_period_start": now_timestamp,
            "current_period_end": now_timestamp + timedelta(days=30).seconds,
            "cancel_at_period_end": cancel_at_period_end,
            "canceled_at": canceled_at,
            "ended_at": ended_at,
            "latest_invoice": latest_invoice,
            "metadata": {**base_metadata, **metadata},
            "discount": (
                {
                    "coupon": {
                        "id": discount.stripe_coupon_id,
                        "metadata": {"discount_id": str(discount.id)},
                    }
                }
                if discount is not None
                else None
            ),
        },
        None,
    )


def construct_stripe_customer(
    *,
    id: str = "CUSTOMER_ID",
    email: str = "customer@example.com",
    name: str | None = "Customer Name",
) -> stripe_lib.Customer:
    return stripe_lib.Customer.construct_from(
        {
            "id": id,
            "email": email,
            "name": name,
            "address": {
                "country": "FR",
            },
        },
        None,
    )


def construct_stripe_invoice(
    *,
    id: str | None = "INVOICE_ID",
    total: int = 12000,
    tax: int = 2000,
    amount_paid: int | None = None,
    charge_id: str | None = "CHARGE_ID",
    subscription_id: str | None = "SUBSCRIPTION_ID",
    subscription_details: dict[str, Any] | None = None,
    customer_id: str = "STRIPE_CUSTOMER_ID",
    lines: list[tuple[str, bool, dict[str, str] | None]] = [("PRICE_ID", False, None)],
    metadata: dict[str, str] = {},
    billing_reason: str = "subscription_create",
    customer_address: dict[str, Any] | None = {"country": "FR"},
    paid_out_of_band: bool = False,
    discount: Discount | None = None,
    created: int | None = None,
) -> stripe_lib.Invoice:
    return stripe_lib.Invoice.construct_from(
        {
            "id": id,
            "total": total,
            "tax": tax,
            "amount_paid": total if amount_paid is None else amount_paid,
            "currency": "usd",
            "charge": charge_id,
            "subscription": subscription_id,
            "subscription_details": subscription_details,
            "customer": customer_id,
            "customer_address": customer_address,
            "lines": {
                "data": [
                    {
                        "price": {"id": price_id, "metadata": metadata or {}},
                        "proration": proration,
                    }
                    for price_id, proration, metadata in lines
                ]
            },
            "metadata": metadata,
            "billing_reason": billing_reason,
            "paid_out_of_band": paid_out_of_band,
            "discount": (
                {
                    "coupon": {
                        "id": discount.stripe_coupon_id,
                        "metadata": {"discount_id": str(discount.id)},
                    }
                }
                if discount is not None
                else None
            ),
            "created": created or int(time.time()),
        },
        None,
    )
