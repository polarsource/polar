from datetime import UTC, datetime
from typing import Literal

from polar.enums import PaymentProcessor
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.models import Dispute, Refund, Transaction
from polar.models.transaction import Processor, ProcessorFeeType, TransactionType
from polar.postgres import AsyncSession

from .base import BaseTransactionService, BaseTransactionServiceError


class ProcessorFeeTransactionError(BaseTransactionServiceError): ...


class BalanceTransactionNotFound(ProcessorFeeTransactionError):
    def __init__(self, payment_transaction: Transaction) -> None:
        message = (
            f"Balance transaction not found for payment transaction "
            f"{payment_transaction.id} with charge ID {payment_transaction.charge_id}"
        )
        super().__init__(message)


class UnsupportedStripeFeeType(ProcessorFeeTransactionError):
    def __init__(self, description: str) -> None:
        self.description = description
        message = f"Unsupported Stripe fee type: {description}"
        super().__init__(message)


def _get_stripe_processor_fee_type(description: str) -> ProcessorFeeType:
    description = description.lower()
    if "payout fee" in description or "account volume" in description:
        return ProcessorFeeType.payout
    if "cross-border transfers" in description:
        return ProcessorFeeType.cross_border_transfer
    if "active account" in description:
        return ProcessorFeeType.account
    if "billing" in description:
        return ProcessorFeeType.subscription
    if (
        "automatic tax" in description
        or "tax api calculation" in description
        or "tax api transaction" in description
    ):
        return ProcessorFeeType.tax
    if "invoicing" in description or "post payment invoices" in description:
        return ProcessorFeeType.invoice
    # Instant Bank Account Validation for ACH payments
    if "connections verification" in description:
        return ProcessorFeeType.payment
    if "radar" in description:
        return ProcessorFeeType.security
    if "3d secure" in description:
        return ProcessorFeeType.payment
    if "authorization optimization" in description:
        return ProcessorFeeType.payment
    if "card account updater" in description:
        return ProcessorFeeType.payment
    if "tax reporting for connect" in description:
        return ProcessorFeeType.tax
    if "identity document check" in description:
        return ProcessorFeeType.security
    if "payments" in description:
        return ProcessorFeeType.payment
    if "card dispute countered fee" in description:
        return ProcessorFeeType.dispute
    if "smart disputes" in description:
        return ProcessorFeeType.dispute
    raise UnsupportedStripeFeeType(description)


class ProcessorFeeTransactionService(BaseTransactionService):
    async def create_payment_fees(
        self, session: AsyncSession, *, payment_transaction: Transaction
    ) -> list[Transaction]:
        fee_transactions: list[Transaction] = []

        if payment_transaction.processor != Processor.stripe:
            return fee_transactions

        if payment_transaction.charge_id is None:
            return fee_transactions

        charge = await stripe_service.get_charge(payment_transaction.charge_id)

        if charge.balance_transaction is None:
            raise BalanceTransactionNotFound(payment_transaction)

        stripe_balance_transaction = await stripe_service.get_balance_transaction(
            get_expandable_id(charge.balance_transaction)
        )
        payment_fee_transaction = Transaction(
            type=TransactionType.processor_fee,
            processor=Processor.stripe,
            processor_fee_type=ProcessorFeeType.payment,
            currency=payment_transaction.currency,
            amount=-stripe_balance_transaction.fee,
            account_currency=payment_transaction.currency,
            account_amount=-stripe_balance_transaction.fee,
            tax_amount=0,
            incurred_by_transaction=payment_transaction,
        )
        session.add(payment_fee_transaction)
        fee_transactions.append(payment_fee_transaction)

        await session.flush()

        return fee_transactions

    async def create_refund_fees(
        self,
        session: AsyncSession,
        *,
        refund: Refund,
        refund_transaction: Transaction,
    ) -> list[Transaction]:
        fee_transactions: list[Transaction] = []

        is_stripe_refund = refund.processor == PaymentProcessor.stripe
        is_stripe_refund_trx = refund_transaction.processor == Processor.stripe
        if not (is_stripe_refund and is_stripe_refund_trx):
            return fee_transactions

        if refund.processor_balance_transaction_id is None:
            return fee_transactions

        balance_transaction = await stripe_service.get_balance_transaction(
            refund.processor_balance_transaction_id,
        )

        refund_fee_transaction = Transaction(
            type=TransactionType.processor_fee,
            processor=refund_transaction.processor,
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

        await session.flush()

        return fee_transactions

    async def create_dispute_fees(
        self,
        session: AsyncSession,
        *,
        dispute: Dispute,
        dispute_transaction: Transaction,
        category: Literal["dispute", "dispute_reversal"],
    ) -> list[Transaction]:
        fee_transactions: list[Transaction] = []

        if dispute.payment_processor != PaymentProcessor.stripe:
            return fee_transactions

        if dispute.payment_processor_id is None:
            return fee_transactions

        stripe_dispute = await stripe_service.get_dispute(dispute.payment_processor_id)
        for balance_transaction in stripe_dispute.balance_transactions:
            if (
                balance_transaction.reporting_category == category
                and balance_transaction.fee > 0
            ):
                dispute_fee_transaction = Transaction(
                    type=TransactionType.processor_fee,
                    processor=Processor.stripe,
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

        await session.flush()

        return fee_transactions

    async def sync_stripe_fees(self, session: AsyncSession) -> list[Transaction]:
        transactions: list[Transaction] = []

        balance_transactions = await stripe_service.list_balance_transactions(
            type="stripe_fee", expand=["data.source"]
        )
        async for balance_transaction in balance_transactions:
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
                processor=Processor.stripe,
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

        await session.flush()

        return transactions


processor_fee_transaction = ProcessorFeeTransactionService(Transaction)
