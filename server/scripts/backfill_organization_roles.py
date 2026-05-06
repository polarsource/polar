"""
Backfill `UserOrganization.role` from `Account.admin_id`.

For each Account, set `role = 'owner'` on the `UserOrganization` row of the
account's admin user. Everyone else stays at the default `member`.

Idempotent — safe to re-run. The script reports how many rows it updated and
how many already carried the correct role.

Run manually post-deploy:

    uv run python -m scripts.backfill_organization_roles
    uv run python -m scripts.backfill_organization_roles --dry-run

The application's dual-write keeps `Account.admin_id` and the `owner` role
aligned for any new orgs created or any `change_admin` flow that fires
after the schema migration deploys; this script only fixes pre-existing
rows.
"""

import typer
from sqlalchemy import select, update

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Account, Organization, UserOrganization
from polar.models.user_organization import OrganizationRole
from polar.postgres import AsyncSession, create_async_engine

from .helper import configure_script_console_logging, typer_async

cli = typer.Typer()


async def run_backfill(
    *,
    session: AsyncSession,
    dry_run: bool,
) -> tuple[int, int, int]:
    """
    Returns (orgs_scanned, rows_updated, rows_already_correct).
    """
    statement = (
        select(
            Organization.id.label("organization_id"),
            Account.admin_id.label("admin_id"),
        )
        .join(Account, Organization.account_id == Account.id)
        .where(Organization.deleted_at.is_(None))
    )
    result = await session.execute(statement)
    pairs = result.all()

    rows_updated = 0
    rows_already_correct = 0

    for organization_id, admin_id in pairs:
        existing = await session.execute(
            select(UserOrganization.role).where(
                UserOrganization.organization_id == organization_id,
                UserOrganization.user_id == admin_id,
            )
        )
        current_role = existing.scalar_one_or_none()
        if current_role is None:
            # Account.admin_id user has no UserOrganization row for this org —
            # rare/legacy state. Skip rather than create one.
            continue
        if current_role == OrganizationRole.owner:
            rows_already_correct += 1
            continue

        if not dry_run:
            await session.execute(
                update(UserOrganization)
                .where(
                    UserOrganization.organization_id == organization_id,
                    UserOrganization.user_id == admin_id,
                )
                .values(role=OrganizationRole.owner)
            )
        rows_updated += 1

    if not dry_run:
        await session.commit()

    return len(pairs), rows_updated, rows_already_correct


@cli.command()
@typer_async
async def backfill(
    dry_run: bool = typer.Option(
        False, "--dry-run", help="Print what would be updated without writing."
    ),
) -> None:
    """Backfill `UserOrganization.role = 'owner'` from `Account.admin_id`."""
    configure_script_console_logging()

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            scanned, updated, already_correct = await run_backfill(
                session=session, dry_run=dry_run
            )

        verb = "would update" if dry_run else "updated"
        typer.echo(
            f"Scanned {scanned} organizations: "
            f"{verb} {updated} owner role(s); "
            f"{already_correct} already correct."
        )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
