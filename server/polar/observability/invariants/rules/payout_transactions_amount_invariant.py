import uuid
from datetime import timedelta

from sqlalchemy import func, over, select

from polar.models import Transaction
from polar.models.transaction import TransactionType

from .base import Invariant, InvariantError


class PayoutTransactionsAmountInvariantError(InvariantError):
    """Exception raised when the PayoutTransactionsAmountInvariant check fails."""

    def __init__(
        self, count: int, payout_transactions: list[uuid.UUID], differences: list[int]
    ) -> None:
        message = (
            f"Found {count} payout transactions with amount mismatch "
            "between payout and sum of paid transactions."
        )
        super().__init__(
            PayoutTransactionsAmountInvariant,
            message,
            {
                "count": count,
                "payout_transactions": {
                    "ids": payout_transactions,
                    "differences": differences,
                    "has_more": count > len(payout_transactions),
                },
            },
        )


class PayoutTransactionsAmountInvariant(Invariant):
    """
    Invariant that checks if payout transaction amounts match the sum of
    transactions that reference them via payout_transaction_id.

    Reversed payouts are automatically excluded because when a payout is reversed,
    the payout_transaction_id on the paid transactions is reset to NULL.

    Failure indicates an issue with payout accounting.
    """

    LIMIT = 10
    AGE_LIMIT = timedelta(days=30)

    async def check(self) -> None:
        # Payout transactions without reversal (same payout_id)
        payout_subq = (
            select(Transaction.id, Transaction.amount)
            .where(
                Transaction.created_at > (func.now() - self.AGE_LIMIT),
                Transaction.type == TransactionType.payout,
                ~Transaction.payout_id.in_(
                    select(Transaction.payout_id).where(
                        Transaction.type == TransactionType.payout_reversal,
                        Transaction.payout_id.isnot(None),
                    )
                ),
            )
            .subquery()
        )

        # Sum of amounts per payout_transaction_id
        paid_subq = (
            select(
                Transaction.payout_transaction_id,
                func.coalesce(func.sum(Transaction.amount), 0).label("total_amount"),
            )
            .where(Transaction.payout_transaction_id.isnot(None))
            .group_by(Transaction.payout_transaction_id)
            .subquery()
        )

        # Find mismatches
        diff_expr = func.abs(payout_subq.c.amount) - func.coalesce(
            paid_subq.c.total_amount, 0
        )
        statement = (
            select(
                payout_subq.c.id,
                diff_expr.label("diff"),
                over(func.count()),
            )
            .select_from(
                payout_subq.outerjoin(
                    paid_subq, payout_subq.c.id == paid_subq.c.payout_transaction_id
                )
            )
            .where(func.abs(diff_expr) > 0)
            .limit(self.LIMIT)
            .order_by(func.abs(diff_expr).desc(), payout_subq.c.id.asc())
        )

        result = await self.session.execute(statement)
        results = result.fetchall()

        count = results[0][2] if results else 0

        if count > 0:
            payout_ids = [row[0] for row in results]
            differences = [row[1] for row in results]
            raise PayoutTransactionsAmountInvariantError(count, payout_ids, differences)
