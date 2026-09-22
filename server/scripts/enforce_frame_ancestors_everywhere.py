"""Switch `frame_ancestors_enforced` on for every organization that has no
opinion on it yet.

The checkout page tells the browser which hosts may frame it, but only for an
organization carrying this flag. Everyone else still serves `frame-ancestors *`,
which is what the page served before any of this. New organizations get the flag
at creation; this is for the stock.

It writes the key only where it is **absent**. An organization support has
switched back off carries the key set to `false`, so a second run leaves it
alone — a revert is a decision, and this script never overrules one.

Organizations we have seen framing from a host their list refuses will break.
`scripts/enforce_frame_ancestors` names them; pass them to `--exclude-slug` and
deal with them by hand.

Usage:
    cd server

    # Count what would change
    uv run python -m scripts.enforce_frame_ancestors_everywhere

    # Write it
    uv run python -m scripts.enforce_frame_ancestors_everywhere --execute

    # Leaving the known casualties behind
    uv run python -m scripts.enforce_frame_ancestors_everywhere --execute \\
        --exclude-slug chrislaccorte --exclude-slug shop4u-llc
"""

import asyncio
from functools import wraps
from typing import Any

import typer
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql.expression import cast, literal

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Organization
from polar.postgres import create_async_engine
from scripts.helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
)

cli = typer.Typer()

configure_script_logging()

FLAG = "frame_ancestors_enforced"


def typer_async(f):  # type: ignore
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


def _undecided(slugs: list[str]) -> Any:
    statement = select(Organization.id).where(
        ~Organization.feature_settings.has_key(FLAG)
    )
    if slugs:
        statement = statement.where(Organization.slug.not_in(slugs))
    return statement


@cli.command()
@typer_async
async def enforce_frame_ancestors_everywhere(
    execute: bool = typer.Option(
        False, help="Write the flag (default: count, write nothing)"
    ),
    exclude_slug: list[str] = typer.Option(
        [], help="Leave these organizations alone, repeatable."
    ),
    batch_size: int = typer.Option(5000, help="Rows per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    if not execute:
        engine = create_async_engine("script")
        try:
            async with create_async_sessionmaker(engine)() as session:
                result = await session.execute(
                    select(func.count()).select_from(
                        _undecided(exclude_slug).subquery()
                    )
                )
                typer.echo(
                    f"{result.scalar_one()} organization(s) would be switched on. "
                    "Pass --execute to write."
                )
        finally:
            await engine.dispose()
        return

    updated = await run_batched_update(
        (
            update(Organization)
            .values(
                feature_settings=Organization.feature_settings.op(
                    "||", return_type=JSONB
                )(cast(literal(f'{{"{FLAG}": true}}'), JSONB)),
                # Self-assign to suppress the onupdate: switching every
                # organization at once must not make them all look freshly
                # edited by their owner.
                modified_at=Organization.modified_at,
            )
            .where(
                Organization.id.in_(_undecided(exclude_slug).limit(limit_bindparam()))
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )
    typer.echo(f"Switched on {updated} organization(s).")


if __name__ == "__main__":
    cli()
