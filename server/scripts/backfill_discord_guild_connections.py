"""Record the Discord guilds organizations already connected.

A Discord benefit could only be created with a valid guild token, so every
(organization, guild) pair one references is legitimate.

Dry-run by default (counts pairs only). Pass --execute to write:

    uv run python -m scripts.backfill_discord_guild_connections --execute
"""

from uuid import UUID

import typer
from sqlalchemy import Select, func, select
from sqlalchemy.dialects.postgresql import insert

from polar.config import settings
from polar.kit.db.postgres import create_async_engine, create_async_sessionmaker
from polar.models import Benefit, DiscordGuildConnection
from polar.models.benefit import BenefitType

from .helper import configure_script_logging, typer_async

cli = typer.Typer()

configure_script_logging()


def _pairs() -> Select[tuple[UUID, str]]:
    return (
        select(
            Benefit.organization_id,
            Benefit.properties["guild_id"].astext.label("guild_id"),
        )
        .where(Benefit.type == BenefitType.discord, Benefit.deleted_at.is_(None))
        .distinct()
    )


@cli.command()
@typer_async
async def backfill_discord_guild_connections(
    execute: bool = typer.Option(False, "--execute", help="Write the connections"),
) -> None:
    engine = create_async_engine(
        dsn=str(settings.get_postgres_dsn("asyncpg")),
        application_name=f"{settings.ENV.value}.script",
        pool_size=1,
        pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
        command_timeout=120.0,
    )
    sessionmaker = create_async_sessionmaker(engine)
    try:
        async with sessionmaker() as session:
            pairs = list((await session.execute(_pairs())).all())
            typer.echo(f"{len(pairs)} (organization, guild) pairs to record")
            if not pairs:
                return
            if not execute:
                typer.echo("Dry run, nothing written. Pass --execute to write.")
                return

            statement = (
                insert(DiscordGuildConnection)
                .values(
                    [
                        {"organization_id": organization_id, "guild_id": guild_id}
                        for organization_id, guild_id in pairs
                    ]
                )
                .on_conflict_do_nothing(
                    index_elements=["organization_id", "guild_id"],
                    index_where=DiscordGuildConnection.deleted_at.is_(None),
                )
            )
            await session.execute(statement)
            await session.commit()
            total = await session.scalar(
                select(func.count())
                .select_from(DiscordGuildConnection)
                .where(DiscordGuildConnection.deleted_at.is_(None))
            )
            typer.echo(f"{total} connections recorded in total")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
