from typing import cast

import stripe as stripe_lib
from sqlalchemy import select

from polar.integrations.stripe.schemas import ProductType
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.models import Pledge, Transaction
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.organization.service import organization as organization_service
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession
from polar.user.service.user import user as user_service

from .base import BaseTransactionService, BaseTransactionServiceError
from .processor_fee import (
    processor_fee_transaction as processor_fee_transaction_service,
)


class PaymentTransactionError(BaseTransactionServiceError): ...


class PledgeDoesNotExist(PaymentTransactionError):
    def __init__(self, charge_id: str, payment_intent_id: str) -> None:
        self.charge_id = charge_id
        self.payment_intent_id = payment_intent_id
        message = (
            f"Received a pledge charge {charge_id} ({payment_intent_id}) from Stripe "
            "but no such Pledge exists."
        )
        super().__init__(message)


class PaymentTransactionService(BaseTransactionService):
    async def create_payment(
        self, session: AsyncSession, *, charge: stripe_lib.Charge
    ) -> Transaction:
        pledge: Pledge | None = None

        # Make sure we don't already have this transaction
        existing_transaction = await self._get_by_charge_id(session, charge.id)
        if existing_transaction is not None:
            return existing_transaction

        # Retrieve customer
        customer_id = None
        payment_user = None
        payment_organization = None
        if charge.customer:
            customer_id = get_expandable_id(charge.customer)
            payment_user = await user_service.get_by_stripe_customer_id(
                session, customer_id
            )
            payment_organization = await organization_service.get_by(
                session, stripe_customer_id=customer_id
            )

        # Retrieve tax amount and country
        tax_amount = 0
        tax_country = None
        tax_state = None
        pledge_invoice = False
        # Polar Custom Checkout sets tax info in metadata
        if "tax_amount" in charge.metadata:
            tax_amount = int(charge.metadata["tax_amount"])
            tax_country = charge.metadata["tax_country"]
            tax_state = charge.metadata.get("tax_state")
        # Stripe Checkout sets tax info in invoice
        elif charge.invoice:
            stripe_invoice = await stripe_service.get_invoice(
                get_expandable_id(charge.invoice)
            )
            if stripe_invoice.tax is not None:
                tax_amount = stripe_invoice.tax
            for total_tax_amount in stripe_invoice.total_tax_amounts:
                tax_rate = cast(stripe_lib.TaxRate, total_tax_amount.tax_rate)
                tax_country = tax_rate.country
                tax_state = tax_rate.state

            if (
                stripe_invoice.metadata
                and stripe_invoice.metadata.get("type") == ProductType.pledge
            ):
                pledge_invoice = True

        # Try to link with a Pledge
        if pledge_invoice or charge.metadata.get("type") == ProductType.pledge:
            assert charge.payment_intent is not None
            payment_intent = get_expandable_id(charge.payment_intent)
            pledge = await pledge_service.get_by_payment_id(session, payment_intent)
            # Give a chance to retry this later in case we didn't create the Pledge yet.
            if pledge is None:
                raise PledgeDoesNotExist(charge.id, payment_intent)
            # If we were not able to link to a payer by Stripe Customer ID,
            # link from the pledge data. Happens for anonymous pledges.
            if payment_user is None and payment_organization is None:
                await session.refresh(pledge, {"user", "by_organization"})
                payment_user = pledge.user
                payment_organization = pledge.by_organization

        risk = charge.outcome or {}
        transaction = Transaction(
            type=TransactionType.payment,
            processor=PaymentProcessor.stripe,
            currency=charge.currency,
            amount=charge.amount - tax_amount,
            account_currency=charge.currency,
            account_amount=charge.amount - tax_amount,
            tax_amount=tax_amount,
            tax_country=tax_country,
            tax_state=tax_state,
            customer_id=customer_id,
            payment_user=payment_user,
            payment_organization=payment_organization,
            charge_id=charge.id,
            pledge=pledge,
            risk_level=risk.get("risk_level"),
            risk_score=risk.get("risk_score"),
            order=None,
        )

        # Compute and link fees
        transaction_fees = await processor_fee_transaction_service.create_payment_fees(
            session, payment_transaction=transaction
        )
        transaction.incurred_transactions = transaction_fees

        session.add(transaction)
        await session.flush()

        return transaction

    async def _get_by_charge_id(
        self, session: AsyncSession, charge_id: str
    ) -> Transaction | None:
        statement = select(Transaction).where(
            Transaction.type == TransactionType.payment,
            Transaction.charge_id == charge_id,
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()


payment_transaction = PaymentTransactionService(Transaction)
