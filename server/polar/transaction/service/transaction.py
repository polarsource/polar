import uuid
from collections.abc import Sequence
from enum import StrEnum
from typing import Any, cast

from sqlalchemy import Select, UnaryExpression, asc, desc, func, or_, select
from sqlalchemy.exc import NoResultFound
from sqlalchemy.orm import aliased, joinedload, subqueryload

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.sorting import Sorting
from polar.models import (
    Account,
    Order,
    Product,
    Transaction,
    User,
)
from polar.models.organization import Organization
from polar.models.transaction import TransactionType
from polar.models.user_organization import UserOrganization
from polar.postgres import AsyncReadSession, AsyncSession

from ..schemas import (
    TransactionsBalance,
    TransactionsSummary,
)
from .base import BaseTransactionService


class TransactionSortProperty(StrEnum):
    created_at = "created_at"
    amount = "amount"


class TransactionService(BaseTransactionService):
    async def search(
        self,
        session: AsyncReadSession,
        user: User,
        *,
        type: TransactionType | None = None,
        account_id: uuid.UUID | None = None,
        payment_customer_id: uuid.UUID | None = None,
        payment_organization_id: uuid.UUID | None = None,
        payment_user_id: uuid.UUID | None = None,
        exclude_platform_fees: bool = False,
        pagination: PaginationParams,
        sorting: list[Sorting[TransactionSortProperty]] = [
            (TransactionSortProperty.created_at, True)
        ],
    ) -> tuple[Sequence[Transaction], int]:
        statement = self._get_readable_transactions_statement(user)

        statement = statement.options(
            # Incurred transactions
            subqueryload(Transaction.account_incurred_transactions),
            # Pledge
            subqueryload(Transaction.pledge),
            # IssueReward
            subqueryload(Transaction.issue_reward),
            # Order
            subqueryload(Transaction.order).options(
                joinedload(Order.product).options(joinedload(Product.organization)),
            ),
        )

        if type is not None:
            statement = statement.where(Transaction.type == type)
        if account_id is not None:
            statement = statement.where(Transaction.account_id == account_id)
        if payment_customer_id is not None:
            statement = statement.where(
                Transaction.payment_customer_id == payment_customer_id
            )
        if payment_organization_id is not None:
            statement = statement.where(
                Transaction.payment_organization_id == payment_organization_id
            )
        if payment_user_id is not None:
            statement = statement.where(Transaction.payment_user_id == payment_user_id)
        if exclude_platform_fees:
            statement = statement.where(Transaction.platform_fee_type.is_(None))

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == TransactionSortProperty.created_at:
                order_by_clauses.append(clause_function(Transaction.created_at))
            elif criterion == TransactionSortProperty.amount:
                order_by_clauses.append(clause_function(Transaction.amount))
        statement = statement.order_by(*order_by_clauses)

        results, count = await paginate(session, statement, pagination=pagination)

        return results, count

    async def lookup(
        self, session: AsyncReadSession, id: uuid.UUID, user: User
    ) -> Transaction:
        statement = (
            self._get_readable_transactions_statement(user)
            .options(
                # Incurred transactions
                subqueryload(Transaction.account_incurred_transactions),
                # Pledge
                subqueryload(Transaction.pledge),
                # IssueReward
                subqueryload(Transaction.issue_reward),
                # Order
                subqueryload(Transaction.order).options(
                    joinedload(Order.product).options(joinedload(Product.organization)),
                ),
                # Paid transactions (joining on itself)
                subqueryload(Transaction.paid_transactions).subqueryload(
                    Transaction.pledge
                ),
                subqueryload(Transaction.paid_transactions).subqueryload(
                    Transaction.issue_reward
                ),
                subqueryload(Transaction.paid_transactions)
                .subqueryload(Transaction.order)
                .options(
                    joinedload(Order.product),
                ),
                subqueryload(Transaction.paid_transactions).subqueryload(
                    Transaction.account_incurred_transactions
                ),
                subqueryload(Transaction.paid_transactions).subqueryload(
                    Transaction.order
                ),
                subqueryload(Transaction.paid_transactions),
            )
            .where(Transaction.id == id)
        )
        result = await session.execute(statement)
        transaction = result.scalar_one_or_none()
        if transaction is None:
            raise ResourceNotFound()

        return transaction

    async def get_summary(
        self, session: AsyncReadSession, account: Account
    ) -> TransactionsSummary:
        statement = select(
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
        ).where(Transaction.account_id == account.id)

        result = await session.execute(statement)

        currency = "usd"  # FIXME: Main Polar currency
        account_currency = account.currency
        assert account_currency is not None

        try:
            (
                amount,
                account_amount,
                payout_amount,
                account_payout_amount,
            ) = result.one()._tuple()
        except NoResultFound:
            amount = 0
            account_amount = 0
            payout_amount = 0
            account_payout_amount = 0

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

    async def get_transactions_sum(
        self,
        session: AsyncSession,
        account_id: uuid.UUID | None,
        *,
        type: TransactionType | None = None,
    ) -> int:
        statement = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.account_id == account_id
        )

        if type is not None:
            statement = statement.where(Transaction.type == type)

        result = await session.execute(statement)
        return int(result.scalar_one())

    def _get_readable_transactions_statement(self, user: User) -> Select[Any]:
        PaymentUserOrganization = aliased(UserOrganization)
        statement = (
            select(Transaction)
            .join(Transaction.account, isouter=True)
            .join(
                Organization,
                onclause=Organization.account_id == Account.id,
                isouter=True,
            )
            .join(
                UserOrganization,
                onclause=Organization.id == UserOrganization.organization_id,
                isouter=True,
            )
            .join(User, onclause=User.account_id == Account.id, isouter=True)
            .join(
                PaymentUserOrganization,
                onclause=Transaction.payment_organization_id
                == PaymentUserOrganization.organization_id,
                isouter=True,
            )
            .where(
                or_(
                    User.id == user.id,
                    UserOrganization.user_id == user.id,
                    Transaction.payment_user_id == user.id,
                    PaymentUserOrganization.user_id == user.id,
                )
            )
        )

        return statement


transaction = TransactionService(Transaction)
