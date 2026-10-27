import asyncio
from functools import wraps

import typer
from sqlalchemy import func, select, update

from polar.models.organization_access_token import OrganizationAccessToken
from scripts.helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
)

cli = typer.Typer()

configure_script_logging()

SCOPE_PATTERN = r"organization_access_tokens:\S*"


def typer_async(f):  # type: ignore
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


@cli.command()
@typer_async
async def backfill_remove_organization_access_tokens_scopes(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    await run_batched_update(
        (
            update(OrganizationAccessToken)
            .values(
                scope=func.trim(
                    func.regexp_replace(
                        func.regexp_replace(
                            OrganizationAccessToken.scope, SCOPE_PATTERN, "", "g"
                        ),
                        r"\s+",
                        " ",
                        "g",
                    )
                )
            )
            .where(
                OrganizationAccessToken.id.in_(
                    select(OrganizationAccessToken.id)
                    .where(OrganizationAccessToken.scope.regexp_match(SCOPE_PATTERN))
                    .limit(limit_bindparam())
                ),
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


if __name__ == "__main__":
    cli()
