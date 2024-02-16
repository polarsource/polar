import math

from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.models import Transaction
from polar.models.transaction import FeeType, PaymentProcessor, TransactionType
from polar.postgres import AsyncSession

from .base import BaseTransactionService, BaseTransactionServiceError


def _round_stripe(amount: float) -> int:
    return math.ceil(amount) if amount - int(amount) >= 0.5 else math.floor(amount)


def _get_stripe_subscription_fee(amount: int) -> int:
    return _round_stripe(amount * 0.005)


def _get_stripe_tax_fee(amount: int) -> int:
    return _round_stripe(amount * 0.005)


class FeeTransactionError(BaseTransactionServiceError):
    ...


class FeeTransactionService(BaseTransactionService):
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
                type=TransactionType.fee,
                processor=PaymentProcessor.stripe,
                fee_type=FeeType.payment,
                currency=payment_transaction.currency,
                amount=-stripe_balance_transaction.fee,
                account_currency=payment_transaction.currency,
                account_amount=-stripe_balance_transaction.fee,
                tax_amount=0,
                incurred_by_transaction_id=payment_transaction.id,
            )
            session.add(payment_fee_transaction)
            fee_transactions.append(payment_fee_transaction)

        if charge.invoice is not None:
            invoice = stripe_service.get_invoice(get_expandable_id(charge.invoice))
            if invoice.subscription is not None:
                subscription = stripe_service.get_subscription(
                    get_expandable_id(invoice.subscription)
                )

                # Subscription fee
                fee_amount = _get_stripe_subscription_fee(payment_transaction.amount)
                subscription_fee_transaction = Transaction(
                    type=TransactionType.fee,
                    processor=PaymentProcessor.stripe,
                    fee_type=FeeType.subscription,
                    currency=payment_transaction.currency,
                    amount=-fee_amount,
                    account_currency=payment_transaction.currency,
                    account_amount=-fee_amount,
                    tax_amount=0,
                    incurred_by_transaction_id=payment_transaction.id,
                )
                session.add(subscription_fee_transaction)
                fee_transactions.append(subscription_fee_transaction)

                # Tax fee
                if subscription.automatic_tax.enabled:
                    fee_amount = _get_stripe_tax_fee(payment_transaction.amount)
                    tax_fee_transaction = Transaction(
                        type=TransactionType.fee,
                        processor=PaymentProcessor.stripe,
                        fee_type=FeeType.tax,
                        currency=payment_transaction.currency,
                        amount=-fee_amount,
                        account_currency=payment_transaction.currency,
                        account_amount=-fee_amount,
                        tax_amount=0,
                        incurred_by_transaction_id=payment_transaction.id,
                    )
                    session.add(tax_fee_transaction)
                    fee_transactions.append(tax_fee_transaction)

        await session.commit()

        return fee_transactions


fee_transaction = FeeTransactionService(Transaction)
