from datetime import datetime

import typer

from polar.integrations.tinybird.service import reconcile_events
from polar.kit.db.postgres import create_async_sessionmaker
from polar.postgres import create_async_engine

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


@cli.command()
@typer_async
async def reconcile(
    start: str = typer.Argument(
        help="Start datetime (ISO 8601, e.g. 2025-01-15T10:00:00 or 2025-01-15T10:00:00.123456)",
    ),
    end: str = typer.Argument(
        help="End datetime (ISO 8601, e.g. 2025-01-15T11:00:00 or 2025-01-15T11:00:00.123456)",
    ),
) -> None:
    configure_script_logging()

    parsed_start = datetime.fromisoformat(start)
    parsed_end = datetime.fromisoformat(end)

    if parsed_start >= parsed_end:
        typer.echo("Error: start must be before end", err=True)
        raise typer.Exit(code=1)

    typer.echo(f"Reconciling events from {parsed_start} to {parsed_end}")

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            total_checked, total_missing = await reconcile_events(
                session, parsed_start, parsed_end
            )

        typer.echo(
            f"Done. Checked {total_checked} events, re-ingested {total_missing}."
        )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
