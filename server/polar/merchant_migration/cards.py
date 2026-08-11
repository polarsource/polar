"""Linking the moved cards back to the imported customers and subscriptions.

PAN copy (and PAN import) land the cards on Polar's own Stripe account under the
source's `cus_…` id, but with fresh `pm_…` ids. Until those are read back and
stored as Polar payment methods, an imported subscription has nothing to charge.

This is the `verify_cards` checklist step, and the same check the cutover runs
again per subscription before it stops billing on the source.
"""

from collections.abc import Sequence
from uuid import UUID

import stripe as stripe_lib

from polar.customer.repository import CustomerRepository
from polar.integrations.stripe.service import stripe as stripe_service
from polar.models import Customer, PaymentMethod
from polar.payment_method.service import payment_method as payment_method_service
from polar.postgres import AsyncSession

CARD_TYPE = "card"


async def link_payment_method(
    session: AsyncSession, customer: Customer
) -> PaymentMethod | None:
    """Mirror the cards on Polar's Stripe account onto the Polar customer.

    Returns the payment method to charge, or None while nothing has landed for
    this customer yet. Idempotent: re-running picks up cards that arrived since,
    which is what makes it safe to run once per checklist step and again at
    cutover.
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
        # The customer isn't on Polar's Stripe account: the copy hasn't reached
        # them. Not an error — it's the answer the checklist is asking for.
        return None

    payment_methods = [
        await payment_method_service.upsert_from_stripe(
            session, customer, stripe_payment_method, flush=True
        )
        for stripe_payment_method in stripe_payment_methods
    ]
    if not payment_methods:
        return None

    preferred = _preferred(payment_methods, customer.default_payment_method_id)
    # The renewal falls back to the customer default when a subscription has no
    # method of its own, so an imported customer should have one.
    if customer.default_payment_method_id is None:
        await CustomerRepository.from_session(session).update(
            customer, update_dict={"default_payment_method_id": preferred.id}
        )
    return preferred


def _preferred(
    payment_methods: Sequence[PaymentMethod], default_id: UUID | None
) -> PaymentMethod:
    """Never move a customer off a default they already have. Otherwise take the
    newest card — Stripe lists newest first, and a card is the one type every
    renewal path can charge off-session without a mandate.

    A customer with no copied card still gets one of their other methods rather
    than nothing: ACH and SEPA are migratable by design (only Bacs, Link and
    legacy sources need re-entry, per `CanonicalPaymentMethodType`), so refusing
    them here would strand those subscriptions on the old provider forever.
    """
    for payment_method in payment_methods:
        if payment_method.id == default_id:
            return payment_method
    for payment_method in payment_methods:
        if payment_method.type == CARD_TYPE:
            return payment_method
    return payment_methods[0]
