"""
Realign benefit grants with the status of their license key.

Changing a license key's status from the dashboard used to write only the key,
leaving the parent grant on its previous state: a live key hidden from the
customer portal, or a revoked key still advertised as an active benefit.

The invariant is that a grant is revoked exactly when its key is revoked, so
`granted` and `disabled` keys both keep the entitlement. Only grants that
positively assert the opposite state are touched — grants still pending or
holding a grant error are left alone.

Timestamps are set to now: this records when the two sides were reconciled, not
when the merchant changed the key.

No webhook or event is emitted. Some of these rows diverged over a year ago and
replaying them as fresh grant activity would misinform every subscriber.

Usage:
    cd server

    # Dry-run (default) — show how many grants are out of line:
    uv run python -m scripts.backfill_license_key_grant_state

    # Execute the backfill (batched):
    uv run python -m scripts.backfill_license_key_grant_state --execute
"""

import structlog
import typer
from rich.console import Console
from sqlalchemy import (
    ColumnElement,
    Select,
    Text,
    Update,
    and_,
    cast,
    func,
    select,
    update,
)

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import BenefitGrant, LicenseKey
from polar.models.license_key import LicenseKeyStatus
from polar.postgres import create_async_engine
from scripts.helper import (
    configure_script_console_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()
console = Console()
log = structlog.get_logger()

configure_script_console_logging()


def _diverged(revoke: bool) -> ColumnElement[bool]:
    key_status = (
        LicenseKey.status == LicenseKeyStatus.revoked
        if revoke
        else LicenseKey.status != LicenseKeyStatus.revoked
    )
    stale_state = (
        BenefitGrant.granted_at.is_not(None)
        if revoke
        else BenefitGrant.revoked_at.is_not(None)
    )
    return and_(
        BenefitGrant.deleted_at.is_(None),
        stale_state,
        BenefitGrant.properties.has_key("license_key_id"),
        select(1)
        .where(
            cast(LicenseKey.id, Text)
            == BenefitGrant.properties["license_key_id"].as_string(),
            LicenseKey.deleted_at.is_(None),
            key_status,
        )
        .exists(),
    )


def diverged_count_statement(*, revoke: bool) -> Select[tuple[int]]:
    return select(func.count()).select_from(BenefitGrant).where(_diverged(revoke))


def realign_statement(*, revoke: bool) -> Update:
    subquery = (
        select(BenefitGrant.id)
        .where(_diverged(revoke))
        .order_by(BenefitGrant.id)
        .limit(limit_bindparam())
        .scalar_subquery()
    )
    values = (
        {"granted_at": None, "revoked_at": func.now()}
        if revoke
        else {"granted_at": func.now(), "revoked_at": None}
    )
    return update(BenefitGrant).where(BenefitGrant.id.in_(subquery)).values(**values)


@cli.command()
@typer_async
async def backfill(
    execute: bool = typer.Option(
        False, help="Actually run the backfill (default: dry-run)"
    ),
    batch_size: int = typer.Option(
        5000, min=1, help="Number of rows to process per batch"
    ),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        totals = {}
        async with sessionmaker() as session:
            for revoke in (True, False):
                result = await session.execute(diverged_count_statement(revoke=revoke))
                totals[revoke] = result.scalar_one()

        console.print(
            f"[bold]{totals[True]}[/bold] grant(s) to revoke, "
            f"[bold]{totals[False]}[/bold] grant(s) to grant."
        )

        if totals[True] == 0 and totals[False] == 0:
            console.print("[green]Every grant already matches its license key.")
            return

        if not execute:
            console.print("[yellow]Dry-run — use --execute to realign them.")
            return

        console.rule("[bold]Executing backfill")
        for revoke in (True, False):
            rows_updated = await run_batched_update(
                realign_statement(revoke=revoke),
                batch_size=batch_size,
                sleep_seconds=sleep_seconds,
            )
            log.info("backfill.complete", revoke=revoke, rowcount=rows_updated)
            console.print(
                f"[green]{'Revoked' if revoke else 'Granted'} "
                f"{rows_updated} benefit grant(s)."
            )

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
