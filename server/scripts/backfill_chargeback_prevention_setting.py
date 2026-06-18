import asyncio
from functools import wraps

import typer
from sqlalchemy import func, select, tuple_, update

from polar.models import UserOrganization
from scripts.helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
)

cli = typer.Typer()

configure_script_logging()


def typer_async(f):  # type: ignore
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


@cli.command()
@typer_async
async def backfill(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    await run_batched_update(
        (
            update(UserOrganization)
            .values(
                notification_settings=UserOrganization.notification_settings.op("||")(
                    func.jsonb_build_object("chargeback_prevention", True)
                )
            )
            .where(
                tuple_(
                    UserOrganization.user_id,
                    UserOrganization.organization_id,
                ).in_(
                    select(
                        UserOrganization.user_id,
                        UserOrganization.organization_id,
                    )
                    .where(
                        UserOrganization.notification_settings.is_not(None),
                        ~UserOrganization.notification_settings.has_key(
                            "chargeback_prevention"
                        ),
                    )
                    .limit(limit_bindparam())
                )
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


if __name__ == "__main__":
    cli()
