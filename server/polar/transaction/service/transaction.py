from collections.abc import Sequence
from enum import StrEnum
from typing import Any

from sqlalchemy import UnaryExpression, asc, desc, select

from polar.authz.service import AccessType, Authz
from polar.exceptions import NotPermitted
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.sorting import Sorting
from polar.models import Account, Transaction, User
from polar.postgres import AsyncSession
from polar.transaction.service.base import BaseTransactionService


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


transaction = TransactionService(Transaction)
