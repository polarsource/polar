import time
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Any

import stripe as stripe_lib
from sqlalchemy.util.typing import NotRequired, TypedDict

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
from polar.product.guard import is_static_price


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
    prices: Sequence[ProductPrice] | None = None,
    status: SubscriptionStatus | None = None,
    cancel_at_period_end: bool | None = None,
    revoke: bool = False,
) -> stripe_lib.Subscription:
    if cancel_at_period_end is None:
        cancel_at_period_end = subscription.cancel_at_period_end

    return construct_stripe_subscription(
        customer=customer if customer else subscription.customer,
        product=product if product else subscription.product,
        prices=prices if prices else subscription.prices,
        status=status if status else subscription.status,
        cancel_at_period_end=cancel_at_period_end,
        revoke=revoke,
    )


def construct_stripe_subscription(
    *,
    product: Product,
    prices: Sequence[ProductPrice] | None = None,
    customer: Customer | None = None,
    organization: Organization | None = None,
    status: SubscriptionStatus = SubscriptionStatus.incomplete,
    latest_invoice: stripe_lib.Invoice | None = None,
    cancel_at_period_end: bool = False,
    metadata: dict[str, str] = {},
    discounts: list[str] | None = None,
    revoke: bool = False,
    default_payment_method: str | None = None,
) -> stripe_lib.Subscription:
    now_timestamp = datetime.now(UTC).timestamp()
    prices = prices or product.prices
    base_metadata: dict[str, str] = {
        **({"product_id": str(product.id)} if product is not None else {}),
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
                            "id": price.stripe_price_id,
                            "currency": "USD",
                            "unit_amount": 1000,
                        }
                    }
                    for price in prices
                    if is_static_price(price)
                ]
            },
            "current_period_start": now_timestamp,
            "current_period_end": now_timestamp + timedelta(days=30).seconds,
            "cancel_at_period_end": cancel_at_period_end,
            "canceled_at": canceled_at,
            "ended_at": ended_at,
            "latest_invoice": latest_invoice,
            "metadata": {**base_metadata, **metadata},
            "discounts": discounts or [],
            "default_payment_method": default_payment_method,
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


class StripeLineItem(TypedDict):
    price_id: str
    price_metadata: NotRequired[dict[str, str]]
    amount: int
    tax_amount: int
    proration: NotRequired[bool]
    description: NotRequired[str]


def construct_stripe_invoice(
    *,
    status: str = "draft",
    lines: list[StripeLineItem],
    id: str | None = "INVOICE_ID",
    amount_paid: int | None = None,
    discount_amount: int | None = None,
    charge_id: str | None = "CHARGE_ID",
    subscription_id: str | None = "SUBSCRIPTION_ID",
    subscription_details: dict[str, Any] | None = None,
    customer_id: str = "STRIPE_CUSTOMER_ID",
    metadata: dict[str, str] = {},
    billing_reason: str = "subscription_create",
    customer_address: dict[str, Any] | None = {"country": "FR"},
    paid_out_of_band: bool = False,
    discount: Discount | None = None,
    created: int | None = None,
) -> stripe_lib.Invoice:
    tax = sum(line["tax_amount"] for line in lines)
    subtotal = sum(line["amount"] for line in lines)
    total = subtotal - (discount_amount or 0) + tax

    return stripe_lib.Invoice.construct_from(
        {
            "id": id,
            "status": status,
            "subtotal": subtotal,
            "total": total,
            "tax": tax,
            "amount_paid": total if amount_paid is None else amount_paid,
            "currency": "usd",
            "charge": charge_id,
            "subscription": subscription_id,
            "subscription_details": subscription_details,
            "customer": customer_id,
            "customer_address": customer_address,
            "lines": [
                {
                    "price": {
                        "id": line["price_id"],
                        "metadata": line.get("price_metadata", {}),
                    },
                    "amount": line["amount"],
                    "tax_amounts": [{"amount": line["tax_amount"]}]
                    if line["tax_amount"]
                    else [],
                    "proration": line.get("proration", False),
                    "description": line.get("description", None),
                }
                for line in lines
            ],
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
            "total_discount_amounts": [{"amount": discount_amount}]
            if discount_amount is not None
            else None,
            "total_tax_amounts": [
                {
                    "amount": tax,
                    "taxability_reason": "standard_rated"
                    if tax > 0
                    else "not_collecting",
                    "tax_rate": {
                        "id": "STRIPE_TAX_RATE_ID",
                        "rate_type": "percentage",
                        "percentage": 20.0,
                        "flat_amount": None,
                        "display_name": "VAT",
                        "country": "FR",
                        "state": None,
                    },
                }
            ],
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


def build_stripe_payment_method(
    *,
    type: str = "card",
    details: dict[str, Any] = {},
    customer: str | None = None,
) -> stripe_lib.PaymentMethod:
    obj: dict[str, Any] = {
        "id": "STRIPE_PAYMENT_METHOD_ID",
        "type": type,
        "customer": customer,
    }
    obj[type] = details
    return stripe_lib.PaymentMethod.construct_from(obj, None)


def build_stripe_charge(
    *,
    status: str = "succeeded",
    amount: int = 1000,
    customer: str | None = None,
    invoice: str | None = None,
    payment_intent: str | None = None,
    balance_transaction: str | None = None,
    type: ProductType | None = None,
    amount_refunded: int = 0,
    metadata: dict[str, str] | None = None,
    billing_details: dict[str, Any] | None = None,
    payment_method_details: dict[str, Any] | None = None,
    outcome: dict[str, Any] | None = None,
) -> stripe_lib.Charge:
    metadata = metadata or {}
    obj: dict[str, Any] = {
        "id": "STRIPE_CHARGE_ID",
        "status": status,
        "customer": customer,
        "currency": "usd",
        "amount": amount,
        "invoice": invoice,
        "payment_intent": payment_intent,
        "balance_transaction": balance_transaction,
        "amount_refunded": amount_refunded,
        "metadata": {"type": type, **metadata} if type is not None else metadata,
        "billing_details": billing_details,
        "payment_method_details": payment_method_details,
        "outcome": {
            "reason": None,
            "risk_level": "normal",
            "risk_score": 0,
            **(outcome or {}),
        },
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
