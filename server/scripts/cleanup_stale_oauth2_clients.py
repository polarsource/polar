import asyncio

import typer

from polar.config import settings
from polar.kit.db.postgres import create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.oauth2.repository import OAuth2ClientRepository
from polar.postgres import create_async_engine

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


@cli.command()
@typer_async
async def cleanup_stale_oauth2_clients(
    execute: bool = typer.Option(False, "--execute", help="Delete eligible clients"),
) -> None:
    """Clear the backlog of stale OAuth2 clients in batches."""
    configure_script_logging()
    if not settings.MCP_OAUTH2_CLIENT_ID:
        typer.echo(
            "Set POLAR_MCP_OAUTH2_CLIENT_ID to protect the MCP client.", err=True
        )
        raise typer.Exit(1)

    cutoff = utc_now()
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            repository = OAuth2ClientRepository.from_session(session)
            if not execute:
                count = await repository.count_stale(cutoff)
                typer.echo(f"Dry run: {count} OAuth2 client(s) would be deleted.")
                return

            total = 0
            while deleted := await repository.delete_stale(cutoff):
                await session.commit()
                total += deleted
                typer.echo(f"Deleted {total} OAuth2 client(s) so far.")
                await asyncio.sleep(0.5)
            typer.echo(f"Done. Deleted {total} OAuth2 client(s).")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
