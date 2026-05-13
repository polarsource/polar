import asyncio
import traceback
import uuid
from dataclasses import dataclass, field

import typer
from rich.progress import Progress, TaskID

from polar.config import settings
from polar.integrations.plain.service import plain as plain_service
from polar.kit.db.postgres import (
    AsyncSessionMaker,
    create_async_sessionmaker,
)
from polar.models import Organization
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession, create_async_engine
from polar.user.repository import UserRepository

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


async def _process_organization(
    *,
    organization: Organization,
    sessionmaker: AsyncSessionMaker,
    semaphore: asyncio.Semaphore,
    result: BackfillResult,
    result_lock: asyncio.Lock,
    progress: Progress,
    task_id: TaskID,
    dry_run: bool,
) -> None:
    async with semaphore:
        async with sessionmaker() as task_session:
            user_repository = UserRepository.from_session(task_session)
            members = await user_repository.get_all_by_organization(organization.id)

        tenant_external_id = str(organization.id)

        if not members:
            async with result_lock:
                result.tenants_without_members += 1

        if dry_run:
            typer.echo(
                f"  Would upsert tenant {organization.name} ({tenant_external_id}) "
                f"with {len(members)} members"
            )
            progress.advance(task_id)
            return

        try:
            await plain_service.upsert_tenant(
                external_id=tenant_external_id, name=organization.name
            )
            async with result_lock:
                result.tenants_upserted += 1
        except Exception:
            async with result_lock:
                result.tenant_errors += 1
                result.error_details.append(
                    (
                        tenant_external_id,
                        f"upsert_tenant {organization.name}",
                        traceback.format_exc(),
                    )
                )
            progress.advance(task_id)
            return

        for user in members:
            try:
                await plain_service.upsert_customer(
                    external_id=str(user.id),
                    email=user.email,
                    email_verified=user.email_verified,
                )
                await plain_service.add_customer_to_tenant(
                    customer_external_id=str(user.id),
                    tenant_external_id=tenant_external_id,
                )
                async with result_lock:
                    result.members_added += 1
            except Exception:
                async with result_lock:
                    result.member_errors += 1
                    result.error_details.append(
                        (
                            tenant_external_id,
                            f"add_customer_to_tenant {user.id}",
                            traceback.format_exc(),
                        )
                    )

        progress.advance(task_id)


async def run_backfill(
    *,
    session: AsyncSession,
    sessionmaker: AsyncSessionMaker,
    dry_run: bool = False,
    limit: int | None = None,
    concurrency: int = 20,
) -> BackfillResult:
    result = BackfillResult()

    self_org_id = uuid.UUID(settings.POLAR_ORGANIZATION_ID)

    organization_repository = OrganizationRepository.from_session(session)

    typer.echo("Loading already-synced Plain tenants...")
    synced_external_ids = await plain_service.list_all_tenant_external_ids()
    typer.echo(f"Found {len(synced_external_ids)} tenants already in Plain")

    typer.echo("Loading organizations...")
    organizations_statement = (
        organization_repository.get_base_statement()
        .where(
            Organization.can_authenticate,
            Organization.id != self_org_id,
        )
        .order_by(Organization.created_at)
    )
    if limit is not None:
        organizations_statement = organizations_statement.limit(limit)
    all_organizations = await organization_repository.get_all(organizations_statement)
    organizations = [
        organization
        for organization in all_organizations
        if str(organization.id) not in synced_external_ids
    ]
    typer.echo(
        f"Loaded {len(all_organizations)} organizations, "
        f"{len(all_organizations) - len(organizations)} already synced, "
        f"{len(organizations)} to process"
    )

    semaphore = asyncio.Semaphore(concurrency)
    result_lock = asyncio.Lock()

    with Progress() as progress:
        task_id = progress.add_task(
            "[cyan]Syncing tenants...", total=len(organizations)
        )
        await asyncio.gather(
            *(
                _process_organization(
                    organization=organization,
                    sessionmaker=sessionmaker,
                    semaphore=semaphore,
                    result=result,
                    result_lock=result_lock,
                    progress=progress,
                    task_id=task_id,
                    dry_run=dry_run,
                )
                for organization in organizations
            )
        )

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
    concurrency: int = typer.Option(
        20, help="Number of organizations to process in parallel"
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
            result = await run_backfill(
                session=session,
                sessionmaker=sessionmaker,
                dry_run=dry_run,
                limit=limit,
                concurrency=concurrency,
            )

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
