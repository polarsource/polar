from typing import Any

import stripe as stripe_lib

from polar.integrations.stripe.schemas import ProductType
from polar.kit.utils import generate_uuid


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


def build_stripe_balance_transaction(
    *,
    amount: int = 1000,
    currency: str = "usd",
    fee: int | None = 100,
    reporting_category: str | None = None,
    exchange_rate: float | None = None,
) -> stripe_lib.BalanceTransaction:
    obj: dict[str, Any] = {
        "id": "STRIPE_BALANCE_TRANSACTION_ID",
        "amount": amount,
        "currency": currency,
        "fee": fee,
        "exchange_rate": exchange_rate,
    }
    if reporting_category:
        obj["reporting_category"] = reporting_category

    return stripe_lib.BalanceTransaction.construct_from(obj, None)


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
    id: str = "STRIPE_CHARGE_ID",
    status: str = "succeeded",
    amount: int = 1000,
    currency: str = "usd",
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
        "id": id,
        "status": status,
        "customer": customer,
        "currency": currency,
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
    amount: int = 1000,
    currency: str = "usd",
    reason: str = "requested_by_customer",
    id: str | None = None,
    charge_id: str | None = None,
    payment_intent: str | None = None,
    balance_transaction: str | None = None,
    metadata: dict[str, str] | None = None,
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
            "currency": currency,
            "amount": amount,
            "reason": reason,
            "destination_details": "{}",
            "balance_transaction": balance_transaction,
            "receipt_number": None,
            "payment_intent": payment_intent,
            "failure_reason": None,
            "metadata": metadata or {},
        },
        None,
    )


def build_stripe_dispute(
    *,
    status: str,
    id: str = "STRIPE_DISPUTE_ID",
    charge_id: str = "STRIPE_CHARGE_ID",
    amount: int = 1000,
    currency: str = "usd",
    balance_transactions: list[stripe_lib.BalanceTransaction],
) -> stripe_lib.Dispute:
    return stripe_lib.Dispute.construct_from(
        {
            "id": id,
            "status": status,
            "charge": charge_id,
            "currency": currency,
            "amount": amount,
            "balance_transactions": balance_transactions,
        },
        None,
    )


def build_stripe_payment_intent(
    *,
    id: str = "STRIPE_PAYMENT_INTENT_ID",
    status: str = "requires_payment_method",
    amount: int = 1000,
    currency: str = "usd",
    customer: str | None = None,
    receipt_email: str | None = None,
    metadata: dict[str, str] | None = None,
    latest_charge: str | None = None,
    last_payment_error: dict[str, Any] | None = None,
) -> stripe_lib.PaymentIntent:
    obj: dict[str, Any] = {
        "id": id,
        "status": status,
        "amount": amount,
        "currency": currency,
        "customer": customer,
        "receipt_email": receipt_email,
        "metadata": metadata or {},
        "latest_charge": latest_charge,
        "last_payment_error": last_payment_error,
    }

    return stripe_lib.PaymentIntent.construct_from(obj, None)
