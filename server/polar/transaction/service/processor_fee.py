import math
from datetime import UTC, datetime
from typing import Literal

from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.models import Transaction
from polar.models.transaction import PaymentProcessor, ProcessorFeeType, TransactionType
from polar.postgres import AsyncSession

from .base import BaseTransactionService, BaseTransactionServiceError


class ProcessorFeeTransactionError(BaseTransactionServiceError):
    ...


class UnsupportedStripeFeeType(ProcessorFeeTransactionError):
    def __init__(self, description: str) -> None:
        self.description = description
        message = f"Unsupported Stripe fee type: {description}"
        super().__init__(message)


def _round_stripe(amount: float) -> int:
    return math.ceil(amount) if amount - int(amount) >= 0.5 else math.floor(amount)


def _get_stripe_subscription_fee(amount: int) -> int:
    return _round_stripe(amount * 0.005)


def _get_stripe_tax_fee(amount: int) -> int:
    return _round_stripe(amount * 0.005)


def _get_stripe_processor_fee_type(description: str) -> ProcessorFeeType:
    description = description.lower()
    if "payout fee" in description or "account volume" in description:
        return ProcessorFeeType.payout
    if "cross-border transfers" in description:
        return ProcessorFeeType.cross_border_transfer
    if "active account" in description:
        return ProcessorFeeType.account
    if "subscriptions" in description:
        return ProcessorFeeType.subscription
    if "automatic tax" in description:
        return ProcessorFeeType.tax
    if "invoicing" in description:
        return ProcessorFeeType.invoice
    raise UnsupportedStripeFeeType(description)


class ProcessorFeeTransactionService(BaseTransactionService):
    async def create_payment_fees(
        self, session: AsyncSession, *, payment_transaction: Transaction
    ) -> list[Transaction]:
        fee_transactions: list[Transaction] = []

        if payment_transaction.processor != PaymentProcessor.stripe:
            return fee_transactions

        if payment_transaction.charge_id is None:
            return fee_transactions

        charge = stripe_service.get_charge(payment_transaction.charge_id)

        # Payment fee
        if charge.balance_transaction:
            stripe_balance_transaction = stripe_service.get_balance_transaction(
                get_expandable_id(charge.balance_transaction)
            )
            payment_fee_transaction = Transaction(
                type=TransactionType.processor_fee,
                processor=PaymentProcessor.stripe,
                processor_fee_type=ProcessorFeeType.payment,
                currency=payment_transaction.currency,
                amount=-stripe_balance_transaction.fee,
                account_currency=payment_transaction.currency,
                account_amount=-stripe_balance_transaction.fee,
                tax_amount=0,
                incurred_by_transaction_id=payment_transaction.id,
            )
            session.add(payment_fee_transaction)
            fee_transactions.append(payment_fee_transaction)

        await session.commit()

        return fee_transactions

    async def create_refund_fees(
        self,
        session: AsyncSession,
        *,
        refund_transaction: Transaction,
    ) -> list[Transaction]:
        fee_transactions: list[Transaction] = []

        if refund_transaction.processor != PaymentProcessor.stripe:
            return fee_transactions

        if refund_transaction.refund_id is None:
            return fee_transactions

        refund = stripe_service.get_refund(refund_transaction.refund_id)

        if refund.balance_transaction is None:
            return fee_transactions

        balance_transaction = stripe_service.get_balance_transaction(
            get_expandable_id(refund.balance_transaction)
        )

        refund_fee_transaction = Transaction(
            type=TransactionType.processor_fee,
            processor=PaymentProcessor.stripe,
            processor_fee_type=ProcessorFeeType.refund,
            currency=refund_transaction.currency,
            amount=-balance_transaction.fee,
            account_currency=refund_transaction.currency,
            account_amount=-balance_transaction.fee,
            tax_amount=0,
            incurred_by_transaction_id=refund_transaction.id,
        )

        session.add(refund_fee_transaction)
        fee_transactions.append(refund_fee_transaction)

        await session.commit()

        return fee_transactions

    async def create_dispute_fees(
        self,
        session: AsyncSession,
        *,
        dispute_transaction: Transaction,
        category: Literal["dispute", "dispute_reversal"],
    ) -> list[Transaction]:
        fee_transactions: list[Transaction] = []

        if dispute_transaction.processor != PaymentProcessor.stripe:
            return fee_transactions

        if dispute_transaction.dispute_id is None:
            return fee_transactions

        dispute = stripe_service.get_dispute(dispute_transaction.dispute_id)
        balance_transaction = next(
            bt
            for bt in dispute.balance_transactions
            if bt.reporting_category == category
        )

        dispute_fee_transaction = Transaction(
            type=TransactionType.processor_fee,
            processor=PaymentProcessor.stripe,
            processor_fee_type=ProcessorFeeType.dispute,
            currency=dispute_transaction.currency,
            amount=-balance_transaction.fee,
            account_currency=dispute_transaction.currency,
            account_amount=-balance_transaction.fee,
            tax_amount=0,
            incurred_by_transaction_id=dispute_transaction.id,
        )

        session.add(dispute_fee_transaction)
        fee_transactions.append(dispute_fee_transaction)

        await session.commit()

        return fee_transactions

    async def sync_stripe_fees(self, session: AsyncSession) -> list[Transaction]:
        transactions: list[Transaction] = []

        for balance_transaction in stripe_service.list_balance_transactions(
            type="stripe_fee"
        ):
            transaction = await self.get_by(
                session, fee_balance_transaction_id=balance_transaction.id
            )

            # We reached the point where we have already synced all the fees
            if transaction is not None:
                break

            if balance_transaction.description is None:
                continue

            processor_fee_type = _get_stripe_processor_fee_type(
                balance_transaction.description
            )
            transaction = Transaction(
                created_at=datetime.fromtimestamp(balance_transaction.created, tz=UTC),
                type=TransactionType.processor_fee,
                processor=PaymentProcessor.stripe,
                processor_fee_type=processor_fee_type,
                currency=balance_transaction.currency,
                amount=balance_transaction.net,
                account_currency=balance_transaction.currency,
                account_amount=balance_transaction.net,
                tax_amount=0,
                fee_balance_transaction_id=balance_transaction.id,
            )
            session.add(transaction)
            transactions.append(transaction)

        await session.commit()

        return transactions


processor_fee_transaction = ProcessorFeeTransactionService(Transaction)
