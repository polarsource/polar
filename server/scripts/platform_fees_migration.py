import asyncio
import logging.config
from functools import wraps
from typing import Any

import structlog
import typer
from sqlalchemy import select

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import IssueReward, Pledge, Transaction
from polar.models.transaction import TransactionType
from polar.postgres import create_async_engine
from polar.transaction.service.platform_fee import (
    platform_fee_transaction as platform_fee_transaction_service,
)

cli = typer.Typer()


def drop_all(*args: Any, **kwargs: Any) -> Any:
    raise structlog.DropEvent


structlog.configure(processors=[drop_all])
logging.config.dictConfig(
    {
        "version": 1,
        "disable_existing_loggers": True,
    }
)


def typer_async(f):  # type: ignore
    # From https://github.com/tiangolo/typer/issues/85
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


@cli.command()
@typer_async
async def platform_fees_migration(
    dry_run: bool = typer.Option(
        False, help="If `True`, changes won't be commited to the database."
    ),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    async with sessionmaker() as session:
        payment_transactions_statement = (
            select(Transaction)
            .where(Transaction.type == TransactionType.payment)
            .order_by(Transaction.created_at.asc())
        )

        payment_transactions = await session.stream_scalars(
            payment_transactions_statement
        )
        async for payment in payment_transactions:
            typer.echo("\n---\n")
            typer.echo(f"🔄 Handling Payment {payment.id}")

            balance_transactions = await platform_fee_transaction_service._get_balance_transactions_for_payment(
                session, payment_transaction=payment
            )

            if len(balance_transactions) == 0:
                typer.echo(
                    typer.style(
                        f"❌ No balance transactions found for payment {payment.id}",
                        fg="yellow",
                    )
                )
                continue

            for outgoing, incoming in balance_transactions:
                if outgoing.pledge_id is not None:
                    pledge = await session.get(Pledge, outgoing.pledge_id)
                    assert pledge is not None
                    assert outgoing.issue_reward_id is not None
                    issue_reward = await session.get(
                        IssueReward, outgoing.issue_reward_id
                    )
                    assert issue_reward is not None
                    share_amount = issue_reward.get_share_amount(pledge)
                    polar_fee = share_amount - abs(incoming.amount)
                    polar_fee_percentage = (polar_fee / share_amount) * 100

                    outgoing.amount = -share_amount
                    outgoing.account_amount = -share_amount
                    incoming.amount = share_amount
                    incoming.account_amount = share_amount
                    incoming.account_currency = outgoing.currency

                else:
                    polar_fee = payment.amount - abs(incoming.amount)
                    polar_fee_percentage = (polar_fee / abs(payment.amount)) * 100

                    outgoing.amount = -payment.amount
                    outgoing.account_amount = -payment.amount
                    incoming.amount = payment.amount
                    incoming.account_amount = payment.amount
                    incoming.account_currency = outgoing.currency

                session.add(outgoing)
                session.add(incoming)

                fees_reversal_balances = await platform_fee_transaction_service.create_fees_reversal_balances(
                    session, balance_transactions=(outgoing, incoming)
                )
                for outgoing_reversal, incoming_reversal in fees_reversal_balances:
                    outgoing_reversal.created_at = outgoing.created_at
                    incoming_reversal.created_at = incoming.created_at

                    outgoing_reversal.amount = -polar_fee
                    outgoing_reversal.account_amount = -polar_fee
                    outgoing_reversal.account_currency = payment.currency
                    incoming_reversal.amount = polar_fee
                    incoming_reversal.account_amount = polar_fee
                    incoming_reversal.account_currency = payment.currency

                    outgoing_reversal.processor = outgoing.processor
                    incoming_reversal.processor = incoming.processor

                    outgoing_reversal.transfer_id = outgoing.transfer_id
                    incoming_reversal.transfer_id = incoming.transfer_id

                    outgoing_reversal.payout_transaction_id = (
                        outgoing.payout_transaction_id
                    )
                    incoming_reversal.payout_transaction_id = (
                        incoming.payout_transaction_id
                    )

                    session.add(outgoing_reversal)
                    session.add(incoming_reversal)

                    actual_percentage = abs(
                        outgoing_reversal.amount / outgoing.amount * 100
                    )
                    assert actual_percentage == polar_fee_percentage, (
                        f"Nope: {actual_percentage} != {polar_fee_percentage}"
                    )

                    typer.echo(
                        typer.style(
                            f"🔄 Created fees reversal balances for payment {payment.id}"
                            f" - Amount: {outgoing_reversal.amount} {outgoing_reversal.currency}"
                            f" - Percentage: {actual_percentage}%",
                            fg="green",
                        )
                    )

        typer.echo("\n---\n")

        if dry_run:
            await session.rollback()
            typer.echo(
                typer.style("Dry run, changes were not saved to the DB", fg="yellow")
            )
        else:
            await session.commit()


if __name__ == "__main__":
    cli()
