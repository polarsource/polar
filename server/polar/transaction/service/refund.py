import itertools
import math

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.enums import PaymentProcessor
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.math import polar_round
from polar.models import Refund, Transaction
from polar.models.refund import RefundStatus
from polar.models.transaction import TransactionType
from polar.postgres import AsyncSession
from polar.transaction.repository import (
    PaymentTransactionRepository,
    RefundTransactionRepository,
)

from .balance import balance_transaction as balance_transaction_service
from .base import BaseTransactionService, BaseTransactionServiceError
from .processor_fee import (
    processor_fee_transaction as processor_fee_transaction_service,
)


class RefundTransactionError(BaseTransactionServiceError): ...


class NotSucceededRefundError(RefundTransactionError):
    def __init__(self, refund: Refund) -> None:
        self.refund = refund
        super().__init__(f"Refund {refund.id} is not succeeded")


class RefundTransactionAlreadyExistsError(RefundTransactionError):
    def __init__(self, refund: Refund) -> None:
        self.refund = refund
        super().__init__(f"Refund transaction already exists for {refund.id}")


class NotCanceledRefundError(RefundTransactionError):
    def __init__(self, refund: Refund) -> None:
        self.refund = refund
        super().__init__(f"Refund {refund.id} is not canceled or failed")


class RefundTransactionDoesNotExistError(RefundTransactionError):
    def __init__(self, refund: Refund) -> None:
        self.refund = refund
        super().__init__(f"Refund transaction does not exist for {refund.id}")


class RefundTransactionService(BaseTransactionService):
    async def create(self, session: AsyncSession, refund: Refund) -> Transaction:
        if not refund.succeeded:
            raise NotSucceededRefundError(refund)

        repository = RefundTransactionRepository.from_session(session)
        if await repository.get_by_refund_id(refund.id) is not None:
            raise RefundTransactionAlreadyExistsError(refund)

        if refund.processor == PaymentProcessor.stripe:
            assert refund.processor_balance_transaction_id is not None
            balance_transaction = await stripe_service.get_balance_transaction(
                refund.processor_balance_transaction_id
            )
            settlement_amount = balance_transaction.amount
            settlement_currency = balance_transaction.currency
            exchange_rate = -settlement_amount / (refund.amount + refund.tax_amount)
            settlement_tax_amount = -polar_round(refund.tax_amount * exchange_rate)
        else:
            raise NotImplementedError()

        payment_transaction_repository = PaymentTransactionRepository.from_session(
            session
        )
        payment_transaction = await payment_transaction_repository.get_by_payment_id(
            refund.payment_id
        )
        assert payment_transaction is not None

        refund_transaction = Transaction(
            type=TransactionType.refund,
            processor=refund.processor,
            currency=settlement_currency,
            amount=settlement_amount - settlement_tax_amount,
            account_currency=settlement_currency,
            account_amount=settlement_amount - settlement_tax_amount,
            tax_amount=settlement_tax_amount,
            tax_country=payment_transaction.tax_country,
            tax_state=payment_transaction.tax_state,
            presentment_currency=refund.currency,
            presentment_amount=-refund.amount,
            presentment_tax_amount=-refund.tax_amount,
            refund=refund,
            customer_id=payment_transaction.customer_id,
            charge_id=payment_transaction.charge_id,
            payment_customer_id=payment_transaction.payment_customer_id,
            payment_organization_id=payment_transaction.payment_organization_id,
            payment_user_id=payment_transaction.payment_user_id,
            pledge_id=payment_transaction.pledge_id,
            issue_reward_id=payment_transaction.issue_reward_id,
            order_id=payment_transaction.order_id,
        )

        # Compute and link fees
        transaction_fees = await processor_fee_transaction_service.create_refund_fees(
            session, refund=refund, refund_transaction=refund_transaction
        )
        refund_transaction.incurred_transactions = transaction_fees
        session.add(refund_transaction)

        # Create reversal balances if it was already balanced
        await self._create_reversal_balances(
            session,
            payment_transaction=payment_transaction,
            refund_amount=settlement_amount - settlement_tax_amount,
        )
        return refund_transaction

    async def revert(self, session: AsyncSession, refund: Refund) -> Transaction:
        if refund.status not in {RefundStatus.canceled, RefundStatus.failed}:
            raise NotCanceledRefundError(refund)

        repository = RefundTransactionRepository.from_session(session)
        refund_transaction = await repository.get_by_refund_id(refund.id)
        if refund_transaction is None:
            raise RefundTransactionDoesNotExistError(refund)

        payment_transaction_repository = PaymentTransactionRepository.from_session(
            session
        )
        payment_transaction = await payment_transaction_repository.get_by_payment_id(
            refund.payment_id
        )
        assert payment_transaction is not None

        refund_reversal_transaction = Transaction(
            type=TransactionType.refund_reversal,
            processor=refund.processor,
            currency=refund_transaction.currency,
            amount=-refund_transaction.amount,
            account_currency=refund.currency,
            account_amount=-refund_transaction.amount,
            tax_amount=-refund_transaction.tax_amount,
            tax_country=payment_transaction.tax_country,
            tax_state=payment_transaction.tax_state,
            presentment_currency=refund_transaction.presentment_currency,
            presentment_amount=-refund_transaction.presentment_amount
            if refund_transaction.presentment_amount is not None
            else None,
            presentment_tax_amount=-refund_transaction.presentment_tax_amount
            if refund_transaction.presentment_tax_amount is not None
            else None,
            customer_id=payment_transaction.customer_id,
            charge_id=payment_transaction.charge_id,
            refund=refund,
            payment_customer_id=payment_transaction.payment_customer_id,
            payment_organization_id=payment_transaction.payment_organization_id,
            payment_user_id=payment_transaction.payment_user_id,
            pledge_id=payment_transaction.pledge_id,
            issue_reward_id=payment_transaction.issue_reward_id,
            order_id=payment_transaction.order_id,
        )
        session.add(refund_reversal_transaction)

        # Create reversal balances if it was already balanced
        await self._create_revert_reversal_balances(
            session,
            payment_transaction=payment_transaction,
            refund_amount=-refund_transaction.amount,
        )
        return refund_reversal_transaction

    async def create_reversal_balances_for_payment(
        self, session: AsyncSession, *, payment_transaction: Transaction
    ) -> list[tuple[Transaction, Transaction]]:
        """
        Create reversal balances for a refunded payment transaction.

        Mostly useful when releasing held balances: if a payment transaction has
        been refunded before the Account creation, we need to create the reversal
        balances so the refund is correctly accounted for.
        """
        statement = select(Transaction).where(
            Transaction.type == TransactionType.refund,
            Transaction.charge_id == payment_transaction.charge_id,
        )

        result = await session.execute(statement)
        refunds = result.scalars().all()

        reversal_balances: list[tuple[Transaction, Transaction]] = []
        for refund in refunds:
            reversal_balances += await self._create_reversal_balances(
                session,
                payment_transaction=payment_transaction,
                refund_amount=refund.amount,
            )

        return reversal_balances

    async def _create_reversal_balances(
        self,
        session: AsyncSession,
        *,
        payment_transaction: Transaction,
        refund_amount: int,
    ) -> list[tuple[Transaction, Transaction]]:
        total_amount = payment_transaction.amount

        reversal_balances: list[tuple[Transaction, Transaction]] = []
        balance_transactions_couples = await self._get_balance_transactions_for_payment(
            session, payment_transaction=payment_transaction
        )
        for balance_transactions_couple in balance_transactions_couples:
            outgoing, _ = balance_transactions_couple
            # Refund each balance proportionally
            balance_refund_amount = abs(
                int(math.floor(outgoing.amount * refund_amount) / total_amount)
            )
            reversal_balances.append(
                await balance_transaction_service.create_reversal_balance(
                    session,
                    balance_transactions=balance_transactions_couple,
                    amount=balance_refund_amount,
                )
            )
        return reversal_balances

    async def _create_revert_reversal_balances(
        self,
        session: AsyncSession,
        *,
        payment_transaction: Transaction,
        refund_amount: int,
    ) -> list[tuple[Transaction, Transaction]]:
        total_amount = payment_transaction.amount

        revert_reversal_balances: list[tuple[Transaction, Transaction]] = []
        reverse_balance_transactions_couples = (
            await self._get_reverse_balance_transactions_for_payment(
                session, payment_transaction=payment_transaction
            )
        )
        for reverse_balance_transactions_couple in reverse_balance_transactions_couples:
            outgoing, incoming = reverse_balance_transactions_couple
            assert outgoing.account is not None
            # Reverse each balance proportionally
            balance_reversal_amount = abs(
                int(math.floor(outgoing.amount * refund_amount) / total_amount)
            )
            (
                outgoing_reversal,
                incoming_reversal,
            ) = await balance_transaction_service.create_balance(
                session,
                source_account=None,
                destination_account=outgoing.account,
                amount=balance_reversal_amount,
                pledge=outgoing.pledge,
                order=outgoing.order,
                issue_reward=outgoing.issue_reward,
            )

            # Tie the reversal to the original transactions, not the refunds
            # This way, it'll get picked up when transferring the payment
            # Basically, it'll do (+100 - 100 + 100)
            outgoing_reversal.balance_reversal_transaction = (
                incoming.balance_reversal_transaction
            )
            incoming_reversal.balance_reversal_transaction = (
                outgoing.balance_reversal_transaction
            )
            session.add(outgoing_reversal)
            session.add(incoming_reversal)
            revert_reversal_balances.append((outgoing_reversal, incoming_reversal))

        return revert_reversal_balances

    async def _get_reverse_balance_transactions_for_payment(
        self, session: AsyncSession, *, payment_transaction: Transaction
    ) -> list[tuple[Transaction, Transaction]]:
        """
        Get the balance transactions that have been reversed by the refund.
        """
        balance_transactions_statement = select(Transaction.id).where(
            Transaction.type == TransactionType.balance,
            Transaction.payment_transaction_id == payment_transaction.id,
        )
        statement = (
            select(Transaction)
            .where(
                Transaction.type == TransactionType.balance,
                Transaction.balance_reversal_transaction_id.in_(
                    balance_transactions_statement
                ),
                # WARNING: not a bulletproof solution
                # In most cases, reversal balances should either be platform fees or refunds,
                # but other situations may appear in the future.
                Transaction.platform_fee_type.is_(None),
            )
            .order_by(
                Transaction.balance_correlation_key,
                Transaction.account_id.nulls_last(),
            )
            .options(
                joinedload(Transaction.account),
                joinedload(Transaction.pledge),
                joinedload(Transaction.order),
                joinedload(Transaction.issue_reward),
                joinedload(Transaction.balance_reversal_transaction),
            )
        )

        result = await session.execute(statement)
        transactions = list(result.scalars().all())
        return [
            (t1, t2)
            for _, (t1, t2) in itertools.groupby(
                transactions, key=lambda t: t.balance_correlation_key
            )
        ]


refund_transaction = RefundTransactionService(Transaction)
