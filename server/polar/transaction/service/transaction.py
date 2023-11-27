from collections.abc import Sequence
from enum import StrEnum
from typing import Any, cast

from sqlalchemy import UnaryExpression, asc, desc, func, select

from polar.authz.service import AccessType, Authz
from polar.exceptions import NotPermitted
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.sorting import Sorting
from polar.models import Account, Transaction, User
from polar.models.transaction import TransactionType
from polar.postgres import AsyncSession

from ..schemas import (
    TransactionsBalance,
    TransactionsSummary,
)
from .base import BaseTransactionService


class SearchSortProperty(StrEnum):
    created_at = "created_at"
    amount = "amount"


class TransactionService(BaseTransactionService):
    async def search(
        self,
        session: AsyncSession,
        user: User,
        account: Account,
        authz: Authz,
        *,
        type: TransactionType | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[SearchSortProperty]] = [
            (SearchSortProperty.created_at, True)
        ],
    ) -> tuple[Sequence[Transaction], int]:
        if not await authz.can(user, AccessType.read, account):
            raise NotPermitted()

        statement = select(Transaction).where(Transaction.account_id == account.id)

        if type is not None:
            statement = statement.where(Transaction.type == type)

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == SearchSortProperty.created_at:
                order_by_clauses.append(clause_function(Transaction.created_at))
            elif criterion == SearchSortProperty.amount:
                order_by_clauses.append(clause_function(Transaction.amount))

        results, count = await paginate(session, statement, pagination=pagination)

        return results, count

    async def get_summary(
        self, session: AsyncSession, user: User, account: Account, authz: Authz
    ) -> TransactionsSummary:
        if not await authz.can(user, AccessType.read, account):
            raise NotPermitted()

        statement = (
            select(
                Transaction.currency,
                Transaction.account_currency,
                cast(type[int], func.coalesce(func.sum(Transaction.amount), 0)),
                cast(type[int], func.coalesce(func.sum(Transaction.account_amount), 0)),
                cast(
                    type[int],
                    func.coalesce(
                        func.sum(Transaction.amount).filter(
                            Transaction.type == TransactionType.payout
                        ),
                        0,
                    ),
                ),
                cast(
                    type[int],
                    func.coalesce(
                        func.sum(Transaction.account_amount).filter(
                            Transaction.type == TransactionType.payout
                        ),
                        0,
                    ),
                ),
            )
            .where(Transaction.account_id == account.id)
            .group_by(Transaction.currency, Transaction.account_currency)
        )

        result = await session.execute(statement)
        (
            currency,
            account_currency,
            amount,
            account_amount,
            payout_amount,
            account_payout_amount,
        ) = result.one()._tuple()

        return TransactionsSummary(
            balance=TransactionsBalance(
                currency=currency,
                amount=amount,
                account_currency=account_currency,
                account_amount=account_amount,
            ),
            payout=TransactionsBalance(
                currency=currency,
                amount=payout_amount,
                account_currency=account_currency,
                account_amount=account_payout_amount,
            ),
        )


transaction = TransactionService(Transaction)
