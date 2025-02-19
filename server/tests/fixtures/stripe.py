import time
from datetime import UTC, datetime, timedelta
from typing import Any

import stripe as stripe_lib

from polar.integrations.stripe.schemas import ProductType
from polar.kit.utils import generate_uuid
from polar.models import (
    Customer,
    Discount,
    Organization,
    Product,
    ProductPrice,
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
    product: Product | None = None,
    price: ProductPrice | None = None,
    status: SubscriptionStatus | None = None,
    cancel_at_period_end: bool | None = None,
    revoke: bool = False,
) -> stripe_lib.Subscription:
    if cancel_at_period_end is None:
        cancel_at_period_end = subscription.cancel_at_period_end

    return construct_stripe_subscription(
        customer=customer if customer else subscription.customer,
        product=product if product else subscription.product,
        price=price if price else subscription.price,
        status=status if status else subscription.status,
        cancel_at_period_end=cancel_at_period_end,
        revoke=revoke,
    )


def construct_stripe_subscription(
    *,
    product: Product | None,
    price: ProductPrice | None = None,
    customer: Customer | None = None,
    organization: Organization | None = None,
    status: SubscriptionStatus = SubscriptionStatus.incomplete,
    latest_invoice: stripe_lib.Invoice | None = None,
    cancel_at_period_end: bool = False,
    metadata: dict[str, str] = {},
    discount: Discount | None = None,
    revoke: bool = False,
) -> stripe_lib.Subscription:
    now_timestamp = datetime.now(UTC).timestamp()
    price = price or product.prices[0] if product else None
    stripe_price_id = price.stripe_price_id if price else "PRICE_ID"
    base_metadata: dict[str, str] = {
        **({"product_id": str(product.id)} if product is not None else {}),
        **({"product_price_id": str(price.id)} if price is not None else {}),
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
                    {
                        "price": {
                            "id": stripe_price_id,
                            "currency": "USD",
                            "unit_amount": 1000,
                        }
                    }
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


def build_stripe_balance_transaction(
    *,
    fee: int | None = 100,
    reporting_category: str | None = None,
) -> stripe_lib.BalanceTransaction:
    obj: dict[str, Any] = {"id": "STRIPE_BALANCE_TRANSACTION_ID", "fee": fee}
    if reporting_category:
        obj["reporting_category"] = reporting_category

    return stripe_lib.BalanceTransaction.construct_from(obj, None)


def build_stripe_invoice(
    *, tax: int | None = 100, subscription: str | None = None
) -> stripe_lib.Invoice:
    return stripe_lib.Invoice.construct_from(
        {
            "id": "STRIPE_INVOICE_ID",
            "tax": tax,
            "subscription": subscription,
            "total_tax_amounts": [{"tax_rate": {"country": "US", "state": "NY"}}],
            "metadata": None,
        },
        None,
    )


def build_stripe_charge(
    *,
    amount: int = 1000,
    customer: str | None = None,
    invoice: str | None = None,
    payment_intent: str | None = None,
    balance_transaction: str | None = None,
    type: ProductType | None = None,
    amount_refunded: int = 0,
    metadata: dict[str, str] | None = None,
    risk_level: str | None = None,
    risk_score: int | None = None,
) -> stripe_lib.Charge:
    metadata = metadata or {}
    obj: dict[str, Any] = {
        "id": "STRIPE_CHARGE_ID",
        "customer": customer,
        "currency": "usd",
        "amount": amount,
        "invoice": invoice,
        "payment_intent": payment_intent,
        "balance_transaction": balance_transaction,
        "amount_refunded": amount_refunded,
        "metadata": {"type": type, **metadata} if type is not None else metadata,
    }
    if risk_level or risk_score:
        obj["outcome"] = {
            "risk_level": risk_level if risk_level else "normal",
            "risk_score": risk_score if risk_score else 0,
        }

    return stripe_lib.Charge.construct_from(obj, None)


def build_stripe_refund(
    *,
    status: str = "succeeded",
    amount: int = 100,
    reason: str = "requested_by_customer",
    id: str | None = None,
    charge_id: str | None = None,
    payment_intent: str | None = None,
    balance_transaction: str | None = None,
) -> stripe_lib.Refund:
    if not id:
        id = str(generate_uuid()).replace("-", "")
        id = f"re_{id}"

    if not charge_id:
        charge_id = str(generate_uuid()).replace("-", "")
        charge_id = f"ch_{charge_id}"

    return stripe_lib.Refund.construct_from(
        {
            "id": id,
            "charge": charge_id,
            "status": status,
            "currency": "usd",
            "amount": amount,
            "reason": reason,
            "destination_details": "{}",
            "balance_transaction": balance_transaction,
            "receipt_number": None,
            "payment_intent": payment_intent,
        },
        None,
    )


def build_stripe_dispute(
    *,
    status: str,
    id: str = "STRIPE_DISPUTE_ID",
    charge_id: str = "STRIPE_CHARGE_ID",
    amount: int = 100,
    balance_transactions: list[stripe_lib.BalanceTransaction],
) -> stripe_lib.Dispute:
    return stripe_lib.Dispute.construct_from(
        {
            "id": id,
            "status": status,
            "charge": charge_id,
            "currency": "usd",
            "amount": amount,
            "balance_transactions": balance_transactions,
        },
        None,
    )
