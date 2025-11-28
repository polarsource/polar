import asyncio
import logging.config
from functools import wraps
from typing import Any

import structlog
import typer
from rich.progress import Progress
from sqlalchemy import func, select, text
from sqlalchemy.orm import attributes

from polar.config import settings
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.db.postgres import create_async_engine as _create_async_engine
from polar.models.organization import Organization, OrganizationSocials

cli = typer.Typer()


def typer_async(f):  # type: ignore
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


def fix_socials(
    socials: list[OrganizationSocials], pattern: str, replacement: str
) -> list[OrganizationSocials]:
    for social in socials:
        if "url" in social and isinstance(social["url"], str):
            social["url"] = social["url"].replace("https://https//", "https://")
    return socials


async def fix_links(
    batch_size: int = 1000,
    pattern: str = "https://https//",
    replacement: str = "https://",
    session: AsyncSession | None = None,
) -> None:
    engine = None
    own_session = False

    if session is None:
        engine = _create_async_engine(
            dsn=str(settings.get_postgres_dsn("asyncpg")),
            application_name=f"{settings.ENV.value}.script",
            debug=False,
            pool_size=settings.DATABASE_POOL_SIZE,
            pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
            command_timeout=settings.DATABASE_COMMAND_TIMEOUT_SECONDS,
        )
        sessionmaker = create_async_sessionmaker(engine)
        session = sessionmaker()
        own_session = True

    try:
        where_stmt = text("""
                    EXISTS (
                        SELECT 1
                        FROM jsonb_array_elements(socials) AS elem
                        WHERE elem->>'url' LIKE :pattern
                    )
                    """).bindparams(pattern=pattern + "%")
        broken_socials_links = (
            await session.execute(
                select(func.count()).select_from(Organization).where(where_stmt)
            )
        ).scalar_one()

        typer.echo(f"Processing {broken_socials_links} broken links")

        with Progress() as progress:
            processed = 0

            task = progress.add_task(
                "[cyan]Processing events...", total=broken_socials_links
            )

            while True:
                stmt = select(Organization).where(where_stmt).limit(batch_size)
                organizations_result = (await session.execute(stmt)).scalars().all()
                organizations = list(organizations_result)
                if not organizations:
                    break

                for organization in organizations:
                    organization.socials = fix_socials(
                        organization.socials, pattern, replacement
                    )
                    attributes.flag_modified(organization, "socials")
                    session.add(organization)
                await session.commit()
                processed += len(organizations)
                progress.update(task, advance=len(organizations))

            typer.echo("\n---\n")
            typer.echo(f"Successfully processed {processed} organizations")
            typer.echo("\n---\n")

    finally:
        if own_session:
            await session.close()
        if engine is not None:
            await engine.dispose()


def drop_all(*args: Any, **kwargs: Any) -> Any:
    raise structlog.DropEvent


@cli.command()
@typer_async
async def fix_organizations_socials_links(
    batch_size: int = typer.Option(
        1000, help="Number of organizations to process per batch"
    ),
) -> None:
    """
    Update organizations socials which has broken links (such as https://https//x.com)
    """
    # Disable logging when running as CLI
    structlog.configure(processors=[drop_all])
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": True,
        }
    )

    await fix_links(batch_size=batch_size)


if __name__ == "__main__":
    cli()
