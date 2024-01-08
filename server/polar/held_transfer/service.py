import structlog
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.exceptions import PolarError
from polar.kit.services import ResourceServiceReader
from polar.logging import Logger
from polar.models import (
    Account,
    HeldTransfer,
    Transaction,
)
from polar.postgres import AsyncSession
from polar.transaction.service.transfer import (
    transfer_transaction as transfer_transaction_service,
)

log: Logger = structlog.get_logger()


class HeldTransferError(PolarError):
    ...


class HeldTransferService(ResourceServiceReader[HeldTransfer]):
    async def create(
        self, session: AsyncSession, *, held_transfer: HeldTransfer
    ) -> HeldTransfer:
        session.add(held_transfer)
        await session.commit()

        return held_transfer

    async def release_account(
        self, session: AsyncSession, account: Account
    ) -> list[tuple[Transaction, Transaction]]:
        statement = (
            select(HeldTransfer)
            .where(
                HeldTransfer.account_id == account.id, HeldTransfer.deleted_at.is_(None)
            )
            .options(
                joinedload(HeldTransfer.payment_transaction),
                joinedload(HeldTransfer.pledge),
                joinedload(HeldTransfer.subscription),
                joinedload(HeldTransfer.issue_reward),
            )
        )
        held_transfers = await session.stream_scalars(statement)

        transfers_tuples: list[tuple[Transaction, Transaction]] = []
        async for held_transfer in held_transfers:
            transfer_tuple = await transfer_transaction_service.create_transfer(
                session,
                destination_account=account,
                payment_transaction=held_transfer.payment_transaction,
                amount=held_transfer.amount,
                pledge=held_transfer.pledge,
                subscription=held_transfer.subscription,
                issue_reward=held_transfer.issue_reward,
                transfer_metadata=held_transfer.transfer_metadata,
            )
            transfers_tuples.append(transfer_tuple)

            await session.delete(held_transfer)

        await session.commit()

        return transfers_tuples


held_transfer = HeldTransferService(HeldTransfer)
