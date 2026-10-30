from uuid import UUID

import typer
from sqlalchemy import select

from polar.integrations.tinybird.service import ingest_events
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Event, Transaction
from polar.models.transaction import TransactionType
from polar.postgres import create_async_engine
from scripts.helper import typer_async

cli = typer.Typer()


@cli.command()
@typer_async
async def backfill(dry_run: bool = True) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    async with sessionmaker() as session:
        events = (
            await session.scalars(
                select(Event).where(
                    Event.name == "balance.refund",
                    Event.user_metadata["transaction_id"].astext == "None",
                )
            )
        ).all()
        transaction_ids = dict(
            (
                await session.execute(
                    select(Transaction.refund_id, Transaction.id).where(
                        Transaction.type == TransactionType.refund,
                        Transaction.refund_id.in_(
                            [e.user_metadata["refund_id"] for e in events]
                        ),
                    )
                )
            ).tuples()
        )

        for event in events:
            transaction_id = transaction_ids[UUID(event.user_metadata["refund_id"])]
            typer.echo(f"{event.id}: transaction_id -> {transaction_id}")
            event.user_metadata = {
                **event.user_metadata,
                "transaction_id": str(transaction_id),
            }

        typer.echo(f"{len(events)} events")
        if dry_run:
            return

        await session.commit()
        await ingest_events(events)

    await engine.dispose()


if __name__ == "__main__":
    cli()
