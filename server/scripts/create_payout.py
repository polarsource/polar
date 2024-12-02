import argparse
import asyncio
from uuid import UUID

from polar.account.service import account as account_service
from polar.kit.db.postgres import create_async_sessionmaker
from polar.postgres import create_async_engine
from polar.transaction.service.payout import (
    payout_transaction as payout_transaction_service,
)


async def create_payout(account_id: UUID) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    async with sessionmaker() as session:
        account = await account_service.get_by_id(session, account_id)
        if account is None:
            raise ValueError(f"Account with id {account_id} not found")
        await payout_transaction_service.create_payout(session, account=account)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create a payout for an account.")
    parser.add_argument("account_id", type=str, help="The UUID of the account")
    args = parser.parse_args()

    account_id = UUID(args.account_id)
    asyncio.run(create_payout(account_id))
