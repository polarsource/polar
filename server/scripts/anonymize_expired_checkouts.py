import asyncio
from datetime import timedelta

import typer

from polar.checkout.repository import CheckoutRepository
from polar.config import settings
from polar.kit.db.postgres import create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.postgres import create_async_engine

from .helper import configure_script_logging, typer_async

cli = typer.Typer()

configure_script_logging()


@cli.command()
@typer_async
async def anonymize_expired_checkouts(
    retention_days: int = typer.Option(
        settings.EXPIRED_CHECKOUT_RETENTION_PERIOD.days,
        min=0,
        help="Scrub expired checkouts created more than this many days ago",
    ),
    batch_size: int = typer.Option(5000, help="Number of rows to scrub per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
    execute: bool = typer.Option(False, "--execute", help="Apply the changes"),
) -> None:
    """
    Scrub customer PII from expired checkouts past the retention period.

    An expired checkout never produced an order, so nothing downstream needs it.
    Irreversible: reports what it would do unless `--execute` is passed.
    """
    older_than = utc_now() - timedelta(days=retention_days)
    typer.echo(f"Scrubbing checkouts created before {older_than.isoformat()}")

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    anonymized = 0

    try:
        async with sessionmaker() as session:
            repository = CheckoutRepository.from_session(session)

            if not execute:
                pending = await repository.count_expired_pending_anonymization(
                    older_than
                )
                typer.echo(f"Dry run: {pending} checkout(s) would be scrubbed")
                return

            while True:
                batch = await repository.anonymize_expired(
                    older_than, batch_size=batch_size
                )
                await session.commit()
                if batch == 0:
                    break
                anonymized += batch
                typer.echo(f"  {anonymized} scrubbed")
                await asyncio.sleep(sleep_seconds)
    finally:
        await engine.dispose()

    typer.echo(f"Done: {anonymized} checkout(s) anonymized")


if __name__ == "__main__":
    cli()
