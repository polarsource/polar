import asyncio
import traceback
import uuid
from dataclasses import dataclass, field

import typer
from rich.progress import Progress, TaskID

from polar.config import settings
from polar.integrations.polar.client import get_client
from polar.integrations.polar.service import polar_self as polar_self_service
from polar.kit.db.postgres import (
    AsyncSessionMaker,
    create_async_sessionmaker,
)
from polar.models import Organization
from polar.models.organization import SupportTier
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession, create_async_engine

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


@dataclass
class BackfillResult:
    tiers_set: int = 0
    free_skipped: int = 0
    errors: int = 0
    error_details: list[tuple[str, str]] = field(default_factory=list)


async def resolve_support_tier(organization_id: uuid.UUID) -> SupportTier | None:
    """Derive an org's support tier from its active Polar support grant.

    The same mapping the benefit-grant webhook applies, but read-only: no DB
    write and no Plain push. The webhook only fires on future grant changes, so
    this populates the column for existing paying orgs. Returns None (free)
    when there's no Polar customer or no support grant.
    """
    customer = await get_client().get_customer_by_external_id_or_none(
        str(organization_id)
    )
    if customer is None:
        return None
    grant = await polar_self_service._fetch_active_grant(customer.id, "support")
    if grant is None:
        return None
    _, _, _, plain_tier_external_id = polar_self_service._extract_support(
        grant.benefit.metadata or {}, grant.benefit_id
    )
    return SupportTier.from_plain_external_id(plain_tier_external_id)


async def _process_organization(
    *,
    organization_id: uuid.UUID,
    organization_name: str,
    sessionmaker: AsyncSessionMaker,
    semaphore: asyncio.Semaphore,
    result: BackfillResult,
    result_lock: asyncio.Lock,
    progress: Progress,
    task_id: TaskID,
    dry_run: bool,
) -> None:
    async with semaphore:
        try:
            tier = await resolve_support_tier(organization_id)
        except Exception:
            async with result_lock:
                result.errors += 1
                result.error_details.append(
                    (str(organization_id), traceback.format_exc())
                )
            progress.advance(task_id)
            return

        # Free orgs are already NULL by column default — nothing to write.
        if tier is None:
            async with result_lock:
                result.free_skipped += 1
            progress.advance(task_id)
            return

        if dry_run:
            typer.echo(
                f"  Would set {organization_name} ({organization_id}) -> {tier.value}"
            )
            async with result_lock:
                result.tiers_set += 1
            progress.advance(task_id)
            return

        async with sessionmaker() as task_session:
            repository = OrganizationRepository.from_session(task_session)
            organization = await repository.get_by_id(
                organization_id, include_blocked=True
            )
            if organization is not None:
                organization.support_tier = tier
                await task_session.commit()
        async with result_lock:
            result.tiers_set += 1
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
    organizations = await organization_repository.get_all(organizations_statement)
    typer.echo(f"Loaded {len(organizations)} organizations to check")

    semaphore = asyncio.Semaphore(concurrency)
    result_lock = asyncio.Lock()

    with Progress() as progress:
        task_id = progress.add_task(
            "[cyan]Resolving support tiers...", total=len(organizations)
        )
        await asyncio.gather(
            *(
                _process_organization(
                    organization_id=organization.id,
                    organization_name=organization.name,
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
        True, help="Print what would be set without writing to the database"
    ),
    limit: int | None = typer.Option(
        None, help="Maximum number of organizations to process"
    ),
    concurrency: int = typer.Option(
        20, help="Number of organizations to process in parallel"
    ),
) -> None:
    """Backfill Organization.support_tier from active Polar support grants.

    The benefit-grant webhook only fires on future grant changes, so existing
    paying orgs need this one-off pass. Free orgs stay NULL (the column default).
    """
    configure_script_logging()

    if not settings.POLAR_SELF_ENABLED:
        typer.echo(
            "POLAR_ACCESS_TOKEN, POLAR_ORGANIZATION_ID, or POLAR_FREE_PRODUCT_ID "
            "is not configured, aborting."
        )
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
            f"\nDone: {result.tiers_set} tiers set, "
            f"{result.free_skipped} free/untiered skipped, "
            f"{result.errors} errors"
        )
        if result.error_details:
            typer.echo("\nErrors:")
            for organization_id, tb in result.error_details:
                typer.echo(f"\n  {organization_id}:")
                for line in tb.rstrip().splitlines():
                    typer.echo(f"    {line}")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
