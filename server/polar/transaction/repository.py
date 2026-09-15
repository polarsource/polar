from collections.abc import Sequence
from itertools import batched
from uuid import UUID

import logfire
from sqlalchemy import Select, and_, func, or_, select, update
from sqlalchemy.orm import selectinload

from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Account, Order, Payment, Transaction
from polar.models.transaction import PlatformFeeType, TransactionType

from .diagnostics import payout_query_diagnostics

_PAYOUT_UPDATE_BATCH_SIZE = 500


class TransactionRepository(
    RepositorySoftDeletionIDMixin[Transaction, UUID],
    RepositorySoftDeletionMixin[Transaction],
    RepositoryBase[Transaction],
):
    model = Transaction

    async def set_unpaid_transactions_payout(
        self, account: UUID, payout_transaction_id: UUID
    ) -> None:
        # Correlate every span with the Postgres backend running the payout so a
        # stall can be tied to a specific session in monitoring. Best-effort: a
        # failure here must never break the payout.
        backend_pid = await self._get_backend_pid()

        with logfire.span(
            "set_unpaid_transactions_payout",
            account_id=str(account),
            payout_transaction_id=str(payout_transaction_id),
            db_backend_pid=backend_pid,
        ) as span:
            statement = (
                select(Transaction.id)
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
                                Transaction.created_at
                                + Account.payout_transaction_delay
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
                # No key changes: allow concurrent foreign-key references.
                .with_for_update(of=Transaction, key_share=True)
            )

            with logfire.span(
                "select_unpaid_transactions_for_update",
                db_backend_pid=backend_pid,
            ) as select_span:
                async with payout_query_diagnostics.watch(
                    backend_pid=backend_pid,
                    span=select_span,
                    phase="select_for_update",
                ):
                    transaction_ids = (await self.session.scalars(statement)).all()
                select_span.set_attribute("selected_rows", len(transaction_ids))

            batch_count = -(-len(transaction_ids) // _PAYOUT_UPDATE_BATCH_SIZE)
            span.set_attributes(
                {
                    "total_selected_rows": len(transaction_ids),
                    "batch_count": batch_count,
                }
            )

            for ordinal, batch in enumerate(
                batched(transaction_ids, _PAYOUT_UPDATE_BATCH_SIZE), start=1
            ):
                with logfire.span(
                    "update_payout_batch",
                    batch_ordinal=ordinal,
                    batch_count=batch_count,
                    batch_rows=len(batch),
                    db_backend_pid=backend_pid,
                ) as batch_span:
                    update_statement = (
                        update(Transaction)
                        .where(Transaction.id.in_(batch))
                        .values(payout_transaction_id=payout_transaction_id)
                        .execution_options(synchronize_session=False)
                    )
                    async with payout_query_diagnostics.watch(
                        backend_pid=backend_pid,
                        span=batch_span,
                        phase="update_batch",
                        batch_ordinal=ordinal,
                    ):
                        await self.session.execute(update_statement)
                    batch_span.set_attribute("outcome", "success")

    async def _get_backend_pid(self) -> int | None:
        """Postgres backend PID of the payout session, for span correlation.

        Best-effort: instrumentation must never break the payout, so any failure
        is swallowed and correlation is simply omitted.
        """
        try:
            return await self.session.scalar(select(func.pg_backend_pid()))
        except Exception:
            return None

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
