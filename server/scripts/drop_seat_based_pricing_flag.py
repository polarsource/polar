import asyncio
from functools import wraps

import typer
from sqlalchemy import Text, cast, literal, select, update
from sqlalchemy.dialects.postgresql import JSONB

from polar.models import Organization
from scripts.helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
)

cli = typer.Typer()

configure_script_logging()

FLAG = "seat_based_pricing_enabled"


def typer_async(f):  # type: ignore
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


@cli.command()
@typer_async
async def drop_seat_based_pricing_flag(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    await run_batched_update(
        (
            update(Organization)
            .values(
                feature_settings=Organization.feature_settings.op(
                    "-", return_type=JSONB
                )(cast(literal(FLAG), Text)),
                # Self-assign to suppress the onupdate: dropping a key nobody
                # reads must not make every organization look freshly modified.
                modified_at=Organization.modified_at,
            )
            .where(
                Organization.id.in_(
                    select(Organization.id)
                    .where(Organization.feature_settings.has_key(FLAG))
                    .limit(limit_bindparam())
                ),
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


if __name__ == "__main__":
    cli()
