import asyncio
import logging.config
from functools import wraps
from typing import Any

import stripe as stripe_lib
import structlog
import typer
from sqlalchemy import select

from polar.integrations.stripe.schemas import ProductType
from polar.integrations.stripe.utils import get_expandable_id
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Transaction
from polar.models.transaction import TransactionType
from polar.pledge.service import pledge as pledge_service
from polar.postgres import create_async_engine

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
async def pledge_invoice_payment_fix(
    stripe_api_key: str,
    dry_run: bool = typer.Option(
        False, help="If `True`, changes won't be commited to the database."
    ),
) -> None:
    stripe_lib.api_key = stripe_api_key
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    async with sessionmaker() as session:
        payment_transactions_statement = (
            select(Transaction)
            .where(
                Transaction.type == TransactionType.payment,
                Transaction.pledge_id.is_(None),
                Transaction.order_id.is_(None),
            )
            .order_by(Transaction.created_at.asc())
        )

        payment_transactions = await session.stream_scalars(
            payment_transactions_statement
        )
        async for payment in payment_transactions:
            typer.echo("\n---\n")
            typer.echo(f"🔄 Handling Payment {payment.id}")

            if payment.charge_id is None:
                typer.echo(
                    typer.style(
                        f"Payment {payment.id} does not have a charge_id",
                        fg="yellow",
                    )
                )
                continue

            charge = stripe_lib.Charge.retrieve(payment.charge_id)

            if charge.invoice is None:
                typer.echo(
                    typer.style(
                        f"Charge {charge.id} does not have an invoice",
                        fg="yellow",
                    )
                )
                continue

            invoice = stripe_lib.Invoice.retrieve(get_expandable_id(charge.invoice))
            metadata = invoice.metadata

            if metadata is None:
                typer.echo(
                    typer.style(
                        f"Invoice {invoice.id} does not have metadata", fg="yellow"
                    )
                )
                continue

            if metadata.get("type") != ProductType.pledge:
                typer.echo(
                    typer.style(
                        f"Invoice {invoice.id} is not a pledge invoice", fg="yellow"
                    )
                )
                continue

            assert charge.payment_intent is not None
            payment_intent = get_expandable_id(charge.payment_intent)
            pledge = await pledge_service.get_by_payment_id(session, payment_intent)

            if pledge is None:
                typer.echo(
                    typer.style(
                        f"Pledge does not exist for payment {payment.id}",
                        fg="yellow",
                    )
                )
                continue

            payment.pledge_id = pledge.id
            session.add(payment)
            typer.echo(
                typer.style(
                    f"Pledge {pledge.id} linked to payment {payment.id}", fg="green"
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
