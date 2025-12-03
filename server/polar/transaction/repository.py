from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select
from sqlalchemy.orm import selectinload

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Order, Payment, Transaction
from polar.models.transaction import TransactionType


class TransactionRepository(
    RepositorySoftDeletionIDMixin[Transaction, UUID],
    RepositorySoftDeletionMixin[Transaction],
    RepositoryBase[Transaction],
):
    model = Transaction

    async def get_all_paid_transactions_by_payout(
        self, payout_transaction_id: UUID
    ) -> Sequence[Transaction]:
        statement = self.get_paid_transactions_statement(payout_transaction_id)
        return await self.get_all(statement)

    def get_paid_transactions_statement(
        self, payout_transaction_id: UUID
    ) -> Select[tuple[Transaction]]:
        return (
            self.get_base_statement()
            .where(
                Transaction.payout_transaction_id == payout_transaction_id,
            )
            .order_by(Transaction.created_at)
            .options(
                # Order
                selectinload(Transaction.order).joinedload(Order.product),
                # Pledge
                selectinload(Transaction.pledge),
            )
        )


class PaymentTransactionRepository(TransactionRepository):
    async def get_by_payment_id(self, payment_id: UUID) -> Transaction | None:
        statement = (
            self.get_base_statement()
            .join(Payment, onclause=Transaction.charge_id == Payment.processor_id)
            .where(Payment.id == payment_id)
        )
        return await self.get_one_or_none(statement)

    def get_base_statement(
        self, *, include_deleted: bool = False
    ) -> Select[tuple[Transaction]]:
        return (
            super()
            .get_base_statement(include_deleted=include_deleted)
            .where(Transaction.type == TransactionType.payment)
        )


class BalanceTransactionRepository(TransactionRepository):
    async def get_all_unpaid_by_account(self, account: UUID) -> Sequence[Transaction]:
        statement = (
            self.get_base_statement()
            .where(
                Transaction.type == TransactionType.balance,
                Transaction.account_id == account,
                Transaction.payout_transaction_id.is_(None),
            )
            .options(
                selectinload(Transaction.balance_reversal_transaction),
                selectinload(Transaction.balance_reversal_transactions),
                selectinload(Transaction.payment_transaction),
            )
        )
        return await self.get_all(statement)

    def get_base_statement(
        self, *, include_deleted: bool = False
    ) -> Select[tuple[Transaction]]:
        return (
            super()
            .get_base_statement(include_deleted=include_deleted)
            .where(Transaction.type == TransactionType.balance)
        )


class RefundTransactionRepository(TransactionRepository):
    async def get_by_refund_id(self, refund: UUID) -> Transaction | None:
        statement = self.get_base_statement().where(Transaction.refund_id == refund)
        return await self.get_one_or_none(statement)

    def get_base_statement(
        self, *, include_deleted: bool = False
    ) -> Select[tuple[Transaction]]:
        return (
            super()
            .get_base_statement(include_deleted=include_deleted)
            .where(Transaction.type == TransactionType.refund)
        )


class DisputeTransactionRepository(TransactionRepository):
    async def get_by_dispute_id(self, dispute_id: UUID) -> Transaction | None:
        statement = self.get_base_statement().where(
            Transaction.dispute_id == dispute_id
        )
        return await self.get_one_or_none(statement)

    def get_base_statement(
        self, *, include_deleted: bool = False
    ) -> Select[tuple[Transaction]]:
        return (
            super()
            .get_base_statement(include_deleted=include_deleted)
            .where(Transaction.type == TransactionType.dispute)
        )


class PayoutTransactionRepository(TransactionRepository):
    async def get_by_payout_id(self, payout_id: UUID) -> Transaction | None:
        statement = self.get_base_statement().where(Transaction.payout_id == payout_id)
        return await self.get_one_or_none(statement)

    def get_base_statement(
        self, *, include_deleted: bool = False
    ) -> Select[tuple[Transaction]]:
        return (
            super()
            .get_base_statement(include_deleted=include_deleted)
            .where(Transaction.type == TransactionType.payout)
        )
