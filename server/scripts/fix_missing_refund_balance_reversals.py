import asyncio
import logging.config
import math
from functools import wraps
from typing import Any

import structlog
import typer
from sqlalchemy import select

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Transaction
from polar.models.transaction import TransactionType
from polar.postgres import create_async_engine
from polar.transaction.service.balance import (
    balance_transaction as balance_transaction_service,
)
from polar.transaction.service.refund import (
    refund_transaction as refund_transaction_service,
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
async def fix_missing_refund_balance_reversals() -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    async with sessionmaker() as session:
        refunds_statement = (
            select(Transaction)
            .where(Transaction.type == TransactionType.refund)
            .order_by(Transaction.created_at)
        )
        refunds = await session.stream_scalars(refunds_statement)
        async for refund in refunds:
            typer.echo("\n---\n")
            typer.echo(f"🔄 Handling {refund.id} {refund.created_at} {refund.amount}")

            payment_transaction = await refund_transaction_service.get_by(
                session, type=TransactionType.payment, charge_id=refund.charge_id
            )
            if payment_transaction is None:
                typer.echo("❌ Payment transaction not found")
                continue

            typer.echo(f"✅ Payment transaction found: {payment_transaction.id}")

            balance_transactions_couples = (
                await refund_transaction_service._get_balance_transactions_for_payment(
                    session, payment_transaction=payment_transaction
                )
            )
            if len(balance_transactions_couples) == 0:
                typer.echo("🔍 The payment transaction was not balanced. Skipping.")
                continue

            for balance_transactions_couple in balance_transactions_couples:
                outgoing, _ = balance_transactions_couple
                await session.refresh(
                    outgoing,
                    {"balance_reversal_transactions", "incurred_transactions"},
                )
                for (
                    balance_reversal_transaction
                ) in outgoing.balance_reversal_transactions:
                    if (
                        balance_reversal_transaction
                        not in outgoing.incurred_transactions
                    ):
                        typer.echo(
                            f"✅ Refund balance reversal found: {balance_reversal_transaction.id}"
                        )
                        break
                else:
                    typer.echo("❌ Refund not balanced")
                    typer.echo("👨‍🔧 Let's fix this")
                    refund_amount = refund.amount
                    total_amount = (
                        payment_transaction.amount + payment_transaction.tax_amount
                    )

                    # Refund each balance proportionally
                    balance_refund_amount = abs(
                        int(math.floor(outgoing.amount * refund_amount) / total_amount)
                    )
                    (
                        outgoing_reversal,
                        incoming_reversal,
                    ) = await balance_transaction_service.create_reversal_balance(
                        session,
                        balance_transactions=balance_transactions_couple,
                        amount=balance_refund_amount,
                    )

                    outgoing_reversal.created_at = refund.created_at
                    incoming_reversal.created_at = refund.created_at
                    session.add(outgoing_reversal)
                    session.add(incoming_reversal)

                    typer.echo(
                        f"✅ Balance reversal created: {outgoing_reversal.id} {incoming_reversal.id}"
                    )

        await session.commit()


if __name__ == "__main__":
    cli()
