import math

import structlog
from sqlalchemy import select

from polar.enums import PaymentProcessor
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.math import polar_round
from polar.logging import Logger
from polar.models import Dispute, Transaction
from polar.models.transaction import Processor, TransactionType
from polar.postgres import AsyncSession

from ..repository import DisputeTransactionRepository, PaymentTransactionRepository
from .balance import balance_transaction as balance_transaction_service
from .base import BaseTransactionService, BaseTransactionServiceError
from .platform_fee import platform_fee_transaction as platform_fee_transaction_service
from .processor_fee import (
    processor_fee_transaction as processor_fee_transaction_service,
)

log: Logger = structlog.get_logger()


class DisputeTransactionError(BaseTransactionServiceError): ...


class DisputeNotResolved(DisputeTransactionError):
    def __init__(self, dispute: Dispute) -> None:
        self.dispute = dispute
        message = f"Dispute {dispute.id} is not resolved."
        super().__init__(message)


class DisputeTransactionAlreadyExistsError(DisputeTransactionError):
    def __init__(self, dispute: Dispute) -> None:
        self.dispute = dispute
        super().__init__(f"Dispute transaction already exists for {dispute.id}")


class BalanceTransactionNotAvailableError(DisputeTransactionError):
    def __init__(self, dispute_id: str) -> None:
        message = f"Balance transaction not available for dispute {dispute_id}"
        super().__init__(message)


class NotBalancedPaymentTransaction(DisputeTransactionError):
    def __init__(self, payment_transaction: Transaction) -> None:
        self.payment_transaction = payment_transaction
        message = (
            f"Payment transaction {payment_transaction.id} is not balanced, "
            "cannot create dispute fees balances."
        )
        super().__init__(message)


class DisputeTransactionService(BaseTransactionService):
    async def create_dispute(
        self, session: AsyncSession, *, dispute: Dispute
    ) -> tuple[Transaction, Transaction | None]:
        if not dispute.resolved:
            raise DisputeNotResolved(dispute)

        repository = DisputeTransactionRepository.from_session(session)
        if await repository.get_by_dispute_id(dispute.id) is not None:
            raise DisputeTransactionAlreadyExistsError(dispute)

        if dispute.payment_processor == PaymentProcessor.stripe:
            assert dispute.payment_processor_id is not None
            stripe_dispute = await stripe_service.get_dispute(
                dispute.payment_processor_id, expand=["balance_transactions"]
            )
            try:
                balance_transaction = next(
                    bt
                    for bt in stripe_dispute.balance_transactions
                    if bt.reporting_category == "dispute"
                )
            except StopIteration as e:
                raise BalanceTransactionNotAvailableError(stripe_dispute.id) from e

            settlement_amount = balance_transaction.amount
            settlement_currency = balance_transaction.currency
            exchange_rate = -settlement_amount / (dispute.amount + dispute.tax_amount)
            settlement_tax_amount = -polar_round(dispute.tax_amount * exchange_rate)
        else:
            raise NotImplementedError()

        payment_transaction_repository = PaymentTransactionRepository.from_session(
            session
        )
        payment_transaction = await payment_transaction_repository.get_by_payment_id(
            dispute.payment_id
        )
        assert payment_transaction is not None

        # Create the dispute, i.e. the transaction withdrawing the amount
        dispute_transaction = Transaction(
            type=TransactionType.dispute,
            processor=Processor.stripe,
            currency=settlement_currency,
            amount=settlement_amount - settlement_tax_amount,
            account_currency=settlement_currency,
            account_amount=settlement_amount - settlement_tax_amount,
            tax_amount=settlement_tax_amount,
            tax_country=payment_transaction.tax_country,
            tax_state=payment_transaction.tax_state,
            presentment_currency=dispute.currency,
            presentment_amount=-dispute.amount,
            presentment_tax_amount=-dispute.tax_amount,
            dispute=dispute,
            customer_id=payment_transaction.customer_id,
            charge_id=payment_transaction.charge_id,
            payment_customer_id=payment_transaction.payment_customer_id,
            payment_organization_id=payment_transaction.payment_organization_id,
            payment_user_id=payment_transaction.payment_user_id,
            pledge_id=payment_transaction.pledge_id,
            issue_reward_id=payment_transaction.issue_reward_id,
            order_id=payment_transaction.order_id,
            incurred_transactions=[],
        )
        session.add(dispute_transaction)
        dispute_fees = await processor_fee_transaction_service.create_dispute_fees(
            session,
            dispute=dispute,
            dispute_transaction=dispute_transaction,
            category="dispute",
        )
        dispute_transaction.incurred_transactions = dispute_fees

        # We won 😃 Create the dispute reversal, i.e. the transaction reinstating the amount
        dispute_reversal_transaction: Transaction | None = None
        if dispute.status == "won":
            dispute_reversal_transaction = Transaction(
                type=TransactionType.dispute_reversal,
                processor=Processor.stripe,
                currency=settlement_currency,
                amount=-settlement_amount + settlement_tax_amount,
                account_currency=settlement_currency,
                account_amount=-settlement_amount + settlement_tax_amount,
                tax_amount=-settlement_tax_amount,
                tax_country=payment_transaction.tax_country,
                tax_state=payment_transaction.tax_state,
                presentment_currency=dispute.currency,
                presentment_amount=dispute.amount,
                presentment_tax_amount=dispute.tax_amount,
                customer_id=payment_transaction.customer_id,
                charge_id=payment_transaction.charge_id,
                dispute=dispute,
                payment_customer_id=payment_transaction.payment_customer_id,
                payment_organization_id=payment_transaction.payment_organization_id,
                payment_user_id=payment_transaction.payment_user_id,
                pledge_id=payment_transaction.pledge_id,
                issue_reward_id=payment_transaction.issue_reward_id,
                order_id=payment_transaction.order_id,
                incurred_transactions=[],
            )
            session.add(dispute_reversal_transaction)
            dispute_reversal_fees = (
                await processor_fee_transaction_service.create_dispute_fees(
                    session,
                    dispute=dispute,
                    dispute_transaction=dispute_reversal_transaction,
                    category="dispute_reversal",
                )
            )
            dispute_reversal_transaction.incurred_transactions = dispute_reversal_fees
        # We lost 😢 Reverse the balances on the organization's account if it was already balanced
        elif dispute.status == "lost":
            await self._create_reversal_balances(
                session,
                payment_transaction=payment_transaction,
                dispute_amount=-dispute_transaction.amount,
            )

        # Balance the (crazy high) dispute fees on the organization's account
        all_fees = dispute_fees
        if dispute_reversal_transaction is not None:
            all_fees += dispute_reversal_fees

        try:
            await self._create_dispute_fees_balances(
                session, payment_transaction=payment_transaction, dispute_fees=all_fees
            )
        except NotBalancedPaymentTransaction:
            log.warning(
                "Dispute fees balances could not be created for payment transaction",
                payment_transaction_id=payment_transaction.id,
                dispute_id=dispute.id,
            )

        await session.flush()

        return dispute_transaction, dispute_reversal_transaction

    async def create_reversal_balances_for_payment(
        self, session: AsyncSession, *, payment_transaction: Transaction
    ) -> list[tuple[Transaction, Transaction]]:
        """
        Create reversal balances for a disputed payment transaction.

        Mostly useful when releasing held balances: if a payment transaction has
        been disputed before the Account creation, we need to create the reversal
        balances so the dispute is correctly accounted for.
        """
        statement = select(Transaction).where(
            Transaction.type == TransactionType.dispute,
            Transaction.charge_id == payment_transaction.charge_id,
        )
        result = await session.execute(statement)
        disputes = result.scalars().all()

        reversal_balances: list[tuple[Transaction, Transaction]] = []
        for dispute in disputes:
            # Skip if there is a dispute reversal: the operations are neutral
            dispute_reversal = await self.get_by(
                session,
                type=TransactionType.dispute_reversal,
                dispute_id=dispute.dispute_id,
            )
            if dispute_reversal is not None:
                continue

            reversal_balances += await self._create_reversal_balances(
                session,
                payment_transaction=payment_transaction,
                dispute_amount=-dispute.amount,
            )

        return reversal_balances

    async def _create_reversal_balances(
        self,
        session: AsyncSession,
        *,
        payment_transaction: Transaction,
        dispute_amount: int,
    ) -> list[tuple[Transaction, Transaction]]:
        payment_amount = payment_transaction.amount

        reversal_balances: list[tuple[Transaction, Transaction]] = []
        balance_transactions_couples = await self._get_balance_transactions_for_payment(
            session, payment_transaction=payment_transaction
        )
        for balance_transactions_couple in balance_transactions_couples:
            outgoing, _ = balance_transactions_couple
            # dispute each balance proportionally
            balance_dispute_amount = abs(
                int(math.floor(outgoing.amount * dispute_amount) / payment_amount)
            )
            reversal_balances.append(
                await balance_transaction_service.create_reversal_balance(
                    session,
                    balance_transactions=balance_transactions_couple,
                    amount=balance_dispute_amount,
                )
            )

        return reversal_balances

    async def _create_dispute_fees_balances(
        self,
        session: AsyncSession,
        *,
        payment_transaction: Transaction,
        dispute_fees: list[Transaction],
    ) -> list[tuple[Transaction, Transaction]]:
        balance_transactions_couples = await self._get_balance_transactions_for_payment(
            session, payment_transaction=payment_transaction
        )
        if len(balance_transactions_couples) == 0:
            raise NotBalancedPaymentTransaction(payment_transaction)
        return await platform_fee_transaction_service.create_dispute_fees_balances(
            session,
            dispute_fees=dispute_fees,
            balance_transactions=balance_transactions_couples[0],
        )


dispute_transaction = DisputeTransactionService(Transaction)
