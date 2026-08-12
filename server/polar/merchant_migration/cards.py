"""Reading the moved cards back onto the imported customers.

A copy lands them under the source's `cus_…` id but with fresh `pm_…` ids, so
they stay invisible to Polar until stored as payment methods of our own.
"""

from collections.abc import Sequence
from uuid import UUID

import stripe as stripe_lib

from polar.customer.repository import CustomerRepository
from polar.integrations.stripe.service import stripe as stripe_service
from polar.models import Customer, PaymentMethod
from polar.payment_method.service import payment_method as payment_method_service
from polar.postgres import AsyncSession

from .canonical import CanonicalPaymentMethod

CARD_TYPE = "card"


async def link_payment_method(
    session: AsyncSession,
    customer: Customer,
    *,
    source_method: CanonicalPaymentMethod | None = None,
) -> PaymentMethod | None:
    """The method to charge, or None while nothing has landed for this customer.

    ``source_method`` is what the source subscription was charging; its copy
    wins. Idempotent, so it can run again as more cards arrive.
    """
    if customer.stripe_customer_id is None:
        return None

    try:
        stripe_payment_methods = [
            stripe_payment_method
            async for stripe_payment_method in stripe_service.list_payment_methods(
                customer.stripe_customer_id
            )
        ]
    except stripe_lib.InvalidRequestError:
        # No such customer on our account: the copy hasn't reached them.
        return None

    payment_methods = [
        await payment_method_service.upsert_from_stripe(
            session, customer, stripe_payment_method, flush=True
        )
        for stripe_payment_method in stripe_payment_methods
    ]
    if not payment_methods:
        return None

    preferred = _preferred(
        payment_methods, customer.default_payment_method_id, source_method
    )
    # What the renewal charges when a subscription has no method of its own.
    if customer.default_payment_method_id is None:
        await CustomerRepository.from_session(session).update(
            customer, update_dict={"default_payment_method_id": preferred.id}
        )
    return preferred


def _preferred(
    payment_methods: Sequence[PaymentMethod],
    default_id: UUID | None,
    source_method: CanonicalPaymentMethod | None,
) -> PaymentMethod:
    """Ordered by how much each candidate says about what to charge. Any stored
    method beats nothing: ACH and SEPA migrate too, per `requires_reentry`."""
    if source_method is not None:
        for payment_method in payment_methods:
            if _is_copy_of(payment_method, source_method):
                return payment_method
    for payment_method in payment_methods:
        if payment_method.id == default_id:
            return payment_method
    for payment_method in payment_methods:
        if payment_method.type == CARD_TYPE:
            return payment_method
    return payment_methods[0]


def _is_copy_of(
    payment_method: PaymentMethod, source_method: CanonicalPaymentMethod
) -> bool:
    """A copy keeps the card but not its id, so match on what survives."""
    details = {
        "last4": source_method.last4,
        "brand": source_method.brand,
        "exp_month": source_method.exp_month,
        "exp_year": source_method.exp_year,
    }
    known = {key: value for key, value in details.items() if value is not None}
    if not known or payment_method.type != source_method.type.value:
        return False
    return all(
        payment_method.method_metadata.get(key) == value for key, value in known.items()
    )
