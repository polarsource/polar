from collections.abc import Sequence
from typing import cast
from uuid import UUID

from sqlalchemy import (
    ColumnClause,
    CursorResult,
    Select,
    and_,
    column,
    func,
    or_,
    select,
    update,
)
from sqlalchemy.orm import selectinload

from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Account, Order, Payment, Transaction
from polar.models.transaction import PlatformFeeType, TransactionType


class TransactionRepository(
    RepositorySoftDeletionIDMixin[Transaction, UUID],
    RepositorySoftDeletionMixin[Transaction],
    RepositoryBase[Transaction],
):
    model = Transaction

    async def set_unpaid_transactions_payout(
        self, account: UUID, payout_transaction_id: UUID
    ) -> None:
        batch_size = 500
        transaction_ctid: ColumnClause[tuple[int, int]] = column("ctid")
        transaction_ctid.table = Transaction.__table__
        batch = (
            select(transaction_ctid.label("ctid"))
            .select_from(Transaction)
            .join(Account, Account.id == Transaction.account_id)
            .where(
                ~Transaction.is_deleted,
                Transaction.account_id == account,
                Transaction.payout_transaction_id.is_(None),
                or_(
                    # Balance transactions that are either :
                    # * Ready to be paid out (after the payout delay)
                    # * Payout fees we just incurred (we need to pay them out immediately)
                    and_(
                        Transaction.type == TransactionType.balance,
                        or_(
                            Transaction.created_at + Account.payout_transaction_delay
                            <= func.now(),
                            Transaction.platform_fee_type.in_(
                                PlatformFeeType.payout_fee_types()
                            ),
                        ),
                    ),
                    # Payout reversal transactions should always be included
                    Transaction.type == TransactionType.payout_reversal,
                ),
            )
            .order_by(Transaction.created_at, Transaction.id)
            .limit(batch_size)
            .with_for_update(of=Transaction)
            .cte("batch")
        )
        statement = (
            update(Transaction)
            .where(transaction_ctid == batch.c.ctid)
            .values(payout_transaction_id=payout_transaction_id)
            .execution_options(synchronize_session=False)
        )
        while True:
            result = cast(
                CursorResult[Transaction], await self.session.execute(statement)
            )
            if result.rowcount < batch_size:
                break

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
    async def get_by_payment_id(
        self, payment_id: UUID, *, options: Options = ()
    ) -> Transaction | None:
        statement = (
            self.get_base_statement()
            .join(Payment, onclause=Transaction.charge_id == Payment.processor_id)
            .where(Payment.id == payment_id)
            .options(*options)
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
    async def reset_payout_transaction_id(self, payout_transaction_id: UUID) -> None:
        statement = (
            update(Transaction)
            .where(Transaction.payout_transaction_id == payout_transaction_id)
            .values(payout_transaction_id=None)
        )
        await self.session.execute(statement)

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


class PayoutReversalTransactionRepository(TransactionRepository):
    async def get_by_payout_id(self, payout_id: UUID) -> Transaction | None:
        statement = self.get_base_statement().where(Transaction.payout_id == payout_id)
        return await self.get_one_or_none(statement)

    def get_base_statement(
        self, *, include_deleted: bool = False
    ) -> Select[tuple[Transaction]]:
        return (
            super()
            .get_base_statement(include_deleted=include_deleted)
            .where(Transaction.type == TransactionType.payout_reversal)
        )
