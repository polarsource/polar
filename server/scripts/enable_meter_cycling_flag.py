import typer
from sqlalchemy import Update, func, literal, select, update
from sqlalchemy.dialects.postgresql import JSONB

from polar.models import Organization
from scripts.helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()

configure_script_logging()

FLAG = "meter_cycling_enabled"


def enable_statement() -> Update:
    return (
        update(Organization)
        .values(
            feature_settings=Organization.feature_settings.op("||", return_type=JSONB)(
                func.jsonb_build_object(FLAG, literal(True))
            ),
            # Self-assign to suppress the onupdate: flipping a flag the
            # current API no longer exposes must not make every
            # organization look freshly modified.
            modified_at=Organization.modified_at,
        )
        .where(
            Organization.id.in_(
                select(Organization.id)
                .where(Organization.feature_settings[FLAG].as_boolean().is_not(True))
                .limit(limit_bindparam())
            ),
        )
    )


@cli.command()
@typer_async
async def enable_meter_cycling_flag(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    await run_batched_update(
        enable_statement(), batch_size=batch_size, sleep_seconds=sleep_seconds
    )


if __name__ == "__main__":
    cli()
