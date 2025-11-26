from typing import cast
from uuid import UUID

import stripe as stripe_lib
from sqlalchemy import select

from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.kit.math import polar_round
from polar.models import Transaction
from polar.models.transaction import Processor, TransactionType
from polar.postgres import AsyncSession
from polar.worker import enqueue_job

from .base import BaseTransactionService, BaseTransactionServiceError


class PaymentTransactionError(BaseTransactionServiceError): ...


class BalanceTransactionNotAvailableError(PaymentTransactionError):
    def __init__(self, charge_id: str) -> None:
        message = f"Balance transaction not available for charge {charge_id}"
        super().__init__(message)


class PaymentTransactionService(BaseTransactionService):
    async def get_by_charge_id(
        self, session: AsyncSession, charge_id: str
    ) -> Transaction | None:
        statement = select(Transaction).where(
            Transaction.type == TransactionType.payment,
            Transaction.charge_id == charge_id,
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def get_by_order_id(
        self, session: AsyncSession, order_id: UUID
    ) -> Transaction | None:
        return await self.get_by(
            session,
            type=TransactionType.payment,
            order_id=order_id,
        )

    async def create_payment(
        self, session: AsyncSession, *, charge: stripe_lib.Charge
    ) -> Transaction:
        # Make sure we don't already have this transaction
        existing_transaction = await self.get_by_charge_id(session, charge.id)
        if existing_transaction is not None:
            return existing_transaction

        # We need the balance transaction to have the actual settlement amount
        if charge.balance_transaction is None:
            raise BalanceTransactionNotAvailableError(charge.id)

        balance_transaction = await stripe_service.get_balance_transaction(
            get_expandable_id(charge.balance_transaction)
        )

        # Retrieve tax amount and country
        tax_amount = 0
        tax_country = None
        tax_state = None
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

        settlement_amount = balance_transaction.amount
        settlement_currency = balance_transaction.currency
        exchange_rate = balance_transaction.exchange_rate or 1.0
        settlement_tax_amount = polar_round(tax_amount * exchange_rate)

        risk = getattr(charge, "outcome", {})
        transaction = Transaction(
            type=TransactionType.payment,
            processor=Processor.stripe,
            currency=settlement_currency,
            amount=settlement_amount - settlement_tax_amount,
            account_currency=settlement_currency,
            account_amount=settlement_amount - settlement_tax_amount,
            tax_amount=settlement_tax_amount,
            tax_country=tax_country,
            tax_state=tax_state if tax_country in {"US", "CA"} else None,
            presentment_currency=charge.currency,
            presentment_amount=charge.amount - tax_amount,
            presentment_tax_amount=tax_amount,
            customer_id=get_expandable_id(charge.customer) if charge.customer else None,
            charge_id=charge.id,
            risk_level=risk.get("risk_level"),
            risk_score=risk.get("risk_score"),
            # Filled when we handle the invoice
            order=None,
            payment_customer=None,
            # Legacy fields for pledges
            pledge=None,
            payment_organization=None,
            payment_user=None,
        )

        session.add(transaction)
        await session.flush()

        # Enqueue fees creation
        enqueue_job("processor_fee.create_payment_fees", transaction.id)

        return transaction


payment_transaction = PaymentTransactionService(Transaction)
