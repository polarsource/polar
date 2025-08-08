import structlog
from sqlalchemy import or_, select
from sqlalchemy.orm import joinedload

from polar.exceptions import PolarError
from polar.kit.services import ResourceServiceReader
from polar.logging import Logger
from polar.models import (
    Account,
    HeldBalance,
    Transaction,
)
from polar.models.organization import Organization
from polar.postgres import AsyncSession
from polar.transaction.service.balance import (
    balance_transaction as balance_transaction_service,
)
from polar.transaction.service.dispute import (
    dispute_transaction as dispute_transaction_service,
)
from polar.transaction.service.platform_fee import (
    platform_fee_transaction as platform_fee_transaction_service,
)
from polar.transaction.service.refund import (
    refund_transaction as refund_transaction_service,
)

log: Logger = structlog.get_logger()


class HeldBalanceError(PolarError): ...


class HeldBalanceService(ResourceServiceReader[HeldBalance]):
    async def create(
        self, session: AsyncSession, *, held_balance: HeldBalance
    ) -> HeldBalance:
        session.add(held_balance)
        await session.flush()
        return held_balance

    async def release_account(
        self, session: AsyncSession, account: Account
    ) -> list[tuple[Transaction, Transaction]]:
        statement = (
            select(HeldBalance)
            .join(
                Organization,
                onclause=HeldBalance.organization_id == Organization.id,
                isouter=True,
            )
            .where(
                or_(
                    HeldBalance.account_id == account.id,
                    Organization.account_id == account.id,
                ),
                HeldBalance.deleted_at.is_(None),
            )
            .options(
                joinedload(HeldBalance.payment_transaction),
                joinedload(HeldBalance.pledge),
                joinedload(HeldBalance.order),
                joinedload(HeldBalance.issue_reward),
            )
        )
        held_balances = await session.stream_scalars(statement)

        balance_transactions_list: list[tuple[Transaction, Transaction]] = []
        async for held_balance in held_balances:
            balance_transactions = await balance_transaction_service.create_balance(
                session,
                source_account=None,
                destination_account=account,
                payment_transaction=held_balance.payment_transaction,
                amount=held_balance.amount,
                pledge=held_balance.pledge,
                order=held_balance.order,
                issue_reward=held_balance.issue_reward,
            )
            balance_transactions_list.append(balance_transactions)

            platform_fee_transactions = (
                await platform_fee_transaction_service.create_fees_reversal_balances(
                    session, balance_transactions=balance_transactions
                )
            )
            if held_balance.order:
                held_balance.order.platform_fee_amount = sum(
                    incoming.amount for _, incoming in platform_fee_transactions
                )
                session.add(held_balance.order)

            await refund_transaction_service.create_reversal_balances_for_payment(
                session, payment_transaction=held_balance.payment_transaction
            )
            await dispute_transaction_service.create_reversal_balances_for_payment(
                session, payment_transaction=held_balance.payment_transaction
            )

            await session.delete(held_balance)

        return balance_transactions_list


held_balance = HeldBalanceService(HeldBalance)
