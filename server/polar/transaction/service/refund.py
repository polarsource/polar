import math

import stripe as stripe_lib

from polar.integrations.stripe.service import stripe as stripe_service
from polar.models import Transaction
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession

from .base import BaseTransactionService, BaseTransactionServiceError
from .fee import fee_transaction as fee_transaction_service
from .transfer import transfer_transaction as transfer_transaction_service


class RefundTransactionError(BaseTransactionServiceError):
    ...


class RefundUnknownPaymentTransaction(RefundTransactionError):
    def __init__(self, charge_id: str) -> None:
        self.charge_id = charge_id
        message = (
            f"Refund issued for charge {charge_id}, "
            "but the payment transaction is unknown."
        )
        super().__init__(message)


class RefundTransactionService(BaseTransactionService):
    async def create_refunds(
        self, session: AsyncSession, *, charge: stripe_lib.Charge
    ) -> list[Transaction]:
        payment_transaction = await self.get_by(session, charge_id=charge.id)
        if payment_transaction is None:
            raise RefundUnknownPaymentTransaction(charge.id)

        # Get all the refunds for this charge
        refunds = stripe_service.list_refunds(charge=charge.id)

        refund_transactions: list[Transaction] = []
        # Handle each individual refund
        for refund in refunds:
            if refund.status != "succeeded":
                continue

            # Already handled that refund before
            refund_transaction = await self.get_by(
                session, type=TransactionType.refund, refund_id=refund.id
            )
            if refund_transaction is not None:
                continue

            refund_amount = refund.amount
            total_amount = payment_transaction.amount + payment_transaction.tax_amount
            tax_refund_amount = abs(
                int(
                    math.floor(payment_transaction.tax_amount * refund_amount)
                    / total_amount
                )
            )

            refund_transaction = Transaction(
                type=TransactionType.refund,
                processor=PaymentProcessor.stripe,
                currency=refund.currency,
                amount=-refund.amount + tax_refund_amount,
                account_currency=refund.currency,
                account_amount=-refund.amount + tax_refund_amount,
                tax_amount=-tax_refund_amount,
                tax_country=payment_transaction.tax_country,
                tax_state=payment_transaction.tax_state,
                customer_id=payment_transaction.customer_id,
                charge_id=charge.id,
                refund_id=refund.id,
                payment_user_id=payment_transaction.payment_user_id,
                payment_organization_id=payment_transaction.payment_organization_id,
                pledge_id=payment_transaction.pledge_id,
                issue_reward_id=payment_transaction.issue_reward_id,
                subscription_id=payment_transaction.subscription_id,
            )

            # Compute and link fees
            transaction_fees = await fee_transaction_service.create_refund_fees(
                session, refund_transaction=refund_transaction
            )
            refund_transaction.incurred_transaction_fees = transaction_fees

            session.add(refund_transaction)
            refund_transactions.append(refund_transaction)

            # Create reversal transfers if it was already transferred
            transfer_transactions_couples = (
                await self._get_transfer_transactions_for_payment(
                    session, payment_transaction=payment_transaction
                )
            )
            for transfer_transactions_couple in transfer_transactions_couples:
                outgoing, _ = transfer_transactions_couple
                # Refund each transfer proportionally
                transfer_refund_amount = abs(
                    int(math.floor(outgoing.amount * refund_amount) / total_amount)
                )
                await transfer_transaction_service.create_reversal_transfer(
                    session,
                    transfer_transactions=transfer_transactions_couple,
                    destination_currency=refund.currency,
                    amount=transfer_refund_amount,
                    reversal_transfer_metadata={
                        "stripe_charge_id": charge.id,
                        "stripe_refund_id": refund.id,
                    },
                )

        await session.commit()

        return refund_transactions


refund_transaction = RefundTransactionService(Transaction)
