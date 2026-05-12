import traceback
import uuid
from collections.abc import Sequence
from dataclasses import dataclass, field

import typer
from rich.progress import Progress
from sqlalchemy import select

from polar.config import settings
from polar.integrations.plain.service import plain as plain_service
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Organization, User, UserOrganization
from polar.postgres import AsyncSession, create_async_engine

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


@dataclass
class BackfillResult:
    tenants_upserted: int = 0
    members_added: int = 0
    tenants_without_members: int = 0
    tenant_errors: int = 0
    member_errors: int = 0
    error_details: list[tuple[str, str, str]] = field(default_factory=list)


async def _load_organizations(
    session: AsyncSession,
    *,
    self_org_id: uuid.UUID,
    limit: int | None,
) -> Sequence[Organization]:
    statement = (
        select(Organization)
        .where(
            Organization.can_authenticate,
            Organization.id != self_org_id,
        )
        .order_by(Organization.created_at)
    )
    if limit is not None:
        statement = statement.limit(limit)
    result = await session.execute(statement)
    return result.scalars().all()


async def _load_member_user_ids(
    session: AsyncSession, organization_id: uuid.UUID
) -> Sequence[uuid.UUID]:
    statement = (
        select(User.id)
        .join(UserOrganization, UserOrganization.user_id == User.id)
        .where(
            UserOrganization.organization_id == organization_id,
            UserOrganization.deleted_at.is_(None),
            User.deleted_at.is_(None),
        )
        .order_by(UserOrganization.created_at)
    )
    result = await session.execute(statement)
    return [row[0] for row in result.all()]


async def run_backfill(
    *,
    session: AsyncSession,
    dry_run: bool = False,
    limit: int | None = None,
) -> BackfillResult:
    result = BackfillResult()

    self_org_id = uuid.UUID(settings.POLAR_ORGANIZATION_ID)

    typer.echo("Loading organizations...")
    organizations = await _load_organizations(
        session, self_org_id=self_org_id, limit=limit
    )
    typer.echo(f"Loaded {len(organizations)} organizations")

    with Progress() as progress:
        task = progress.add_task("[cyan]Syncing tenants...", total=len(organizations))
        for organization in organizations:
            member_user_ids = await _load_member_user_ids(session, organization.id)
            if not member_user_ids:
                result.tenants_without_members += 1

            tenant_external_id = str(organization.id)

            if dry_run:
                typer.echo(
                    f"  Would upsert tenant {organization.name} ({tenant_external_id}) "
                    f"with {len(member_user_ids)} members"
                )
                progress.advance(task)
                continue

            try:
                await plain_service.upsert_tenant(
                    external_id=tenant_external_id, name=organization.name
                )
                result.tenants_upserted += 1
            except Exception:
                result.tenant_errors += 1
                result.error_details.append(
                    (
                        tenant_external_id,
                        f"upsert_tenant {organization.name}",
                        traceback.format_exc(),
                    )
                )
                progress.advance(task)
                continue

            for user_id in member_user_ids:
                try:
                    await plain_service.add_customer_to_tenant(
                        customer_external_id=str(user_id),
                        tenant_external_id=tenant_external_id,
                    )
                    result.members_added += 1
                except Exception:
                    result.member_errors += 1
                    result.error_details.append(
                        (
                            tenant_external_id,
                            f"add_customer_to_tenant {user_id}",
                            traceback.format_exc(),
                        )
                    )

            progress.advance(task)

    return result


@cli.command()
@typer_async
async def backfill(
    dry_run: bool = typer.Option(
        True, help="Print what would be done without calling Plain"
    ),
    limit: int | None = typer.Option(
        None, help="Maximum number of organizations to process"
    ),
) -> None:
    """Backfill Plain tenants and tenant customers for all active organizations."""
    configure_script_logging()

    if not settings.POLAR_SELF_ENABLED:
        typer.echo(
            "POLAR_ACCESS_TOKEN, POLAR_ORGANIZATION_ID, or POLAR_FREE_PRODUCT_ID "
            "is not configured, aborting."
        )
        raise typer.Exit(1)

    if not plain_service.enabled:
        typer.echo("PLAIN_TOKEN is not configured, aborting.")
        raise typer.Exit(1)

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            result = await run_backfill(session=session, dry_run=dry_run, limit=limit)

        typer.echo(
            f"\nDone: {result.tenants_upserted} tenants upserted, "
            f"{result.members_added} members added, "
            f"{result.tenants_without_members} tenants had no members, "
            f"{result.tenant_errors} tenant errors, "
            f"{result.member_errors} member errors"
        )
        if result.error_details:
            typer.echo("\nErrors:")
            for external_id, operation, tb in result.error_details:
                typer.echo(f"\n  {operation} ({external_id}):")
                for line in tb.rstrip().splitlines():
                    typer.echo(f"    {line}")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
