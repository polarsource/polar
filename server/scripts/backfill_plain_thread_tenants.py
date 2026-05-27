import asyncio
import traceback
import uuid
from collections.abc import Sequence
from dataclasses import dataclass, field

import typer
from rich.progress import Progress
from sqlalchemy import func, or_, select

from polar.config import settings
from polar.integrations.plain.service import plain as plain_service
from polar.kit.db.postgres import (
    AsyncSessionMaker,
    create_async_sessionmaker,
)
from polar.models import OAuthAccount, Organization, User, UserOrganization
from polar.postgres import AsyncSession, create_async_engine

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


@dataclass
class BackfillResult:
    threads_seen: int = 0
    threads_updated: int = 0
    threads_skipped_no_email: int = 0
    threads_skipped_no_org: int = 0
    threads_skipped_ambiguous: int = 0
    thread_errors: int = 0
    error_details: list[tuple[str, str, str]] = field(default_factory=list)


async def _find_organizations_by_email(
    session: AsyncSession, email: str, self_org_id: uuid.UUID
) -> Sequence[Organization]:
    statement = (
        select(Organization)
        .join(
            UserOrganization,
            Organization.id == UserOrganization.organization_id,
            isouter=True,
        )
        .join(User, User.id == UserOrganization.user_id, isouter=True)
        .outerjoin(OAuthAccount, OAuthAccount.user_id == User.id)
        .where(
            Organization.can_authenticate,
            Organization.id != self_org_id,
            or_(
                func.lower(User.email) == email.lower(),
                func.lower(OAuthAccount.account_email) == email.lower(),
                func.lower(Organization.email) == email.lower(),
            ),
        )
        .distinct()
    )
    result = await session.execute(statement)
    return result.unique().scalars().all()


async def _process_thread(
    *,
    thread_id: str,
    customer_id: str,
    sessionmaker: AsyncSessionMaker,
    self_org_id: uuid.UUID,
    semaphore: asyncio.Semaphore,
    result: BackfillResult,
    result_lock: asyncio.Lock,
    dry_run: bool,
    email_cache: dict[str, str | None],
    org_cache: dict[str, list[tuple[uuid.UUID, str]]],
) -> None:
    async with semaphore:
        if customer_id in email_cache:
            email = email_cache[customer_id]
        else:
            try:
                email = await plain_service.get_customer_email(customer_id)
            except Exception:
                async with result_lock:
                    result.thread_errors += 1
                    result.error_details.append(
                        (
                            thread_id,
                            f"get_customer_email {customer_id}",
                            traceback.format_exc(),
                        )
                    )
                return
            email_cache[customer_id] = email

        if not email:
            async with result_lock:
                result.threads_skipped_no_email += 1
            return

        cache_key = email.lower()
        if cache_key in org_cache:
            orgs = org_cache[cache_key]
        else:
            async with sessionmaker() as session:
                fetched = await _find_organizations_by_email(
                    session, email, self_org_id
                )
                orgs = [(o.id, o.name) for o in fetched]
            org_cache[cache_key] = orgs

        if len(orgs) == 0:
            async with result_lock:
                result.threads_skipped_no_org += 1
            typer.echo(f"  No org for thread {thread_id} (email={email})")
            return

        if len(orgs) > 1:
            async with result_lock:
                result.threads_skipped_ambiguous += 1
            org_ids = ", ".join(str(org_id) for org_id, _ in orgs)
            typer.echo(
                f"  Ambiguous orgs for thread {thread_id} (email={email}): {org_ids}"
            )
            return

        org_id, org_name = orgs[0]
        tenant_external_id = str(org_id)

        if dry_run:
            typer.echo(
                f"  Would set tenant {org_name} ({tenant_external_id}) "
                f"on thread {thread_id} (email={email})"
            )
            async with result_lock:
                result.threads_updated += 1
            return

        try:
            await plain_service.update_thread_tenant(
                thread_id=thread_id, tenant_external_id=tenant_external_id
            )
            async with result_lock:
                result.threads_updated += 1
        except Exception:
            async with result_lock:
                result.thread_errors += 1
                result.error_details.append(
                    (
                        thread_id,
                        f"update_thread_tenant {tenant_external_id}",
                        traceback.format_exc(),
                    )
                )


async def run_backfill(
    *,
    sessionmaker: AsyncSessionMaker,
    dry_run: bool = False,
    limit: int | None = None,
    concurrency: int = 5,
    page_size: int = 50,
    customer_ids: list[str] | None = None,
) -> BackfillResult:
    result = BackfillResult()
    self_org_id = uuid.UUID(settings.POLAR_ORGANIZATION_ID)

    semaphore = asyncio.Semaphore(concurrency)
    result_lock = asyncio.Lock()
    email_cache: dict[str, str | None] = {}
    org_cache: dict[str, list[tuple[uuid.UUID, str]]] = {}

    typer.echo("Scanning Plain threads without a tenant...")

    with Progress() as progress:
        task_id = progress.add_task("[cyan]Processing threads...", total=None)

        tasks: list[asyncio.Task[None]] = []
        async with asyncio.TaskGroup() as tg:
            async for thread in plain_service.iter_threads_without_tenant(
                page_size=page_size, customer_ids=customer_ids
            ):
                result.threads_seen += 1
                progress.update(task_id, total=result.threads_seen)

                tasks.append(
                    tg.create_task(
                        _process_thread(
                            thread_id=thread.id,
                            customer_id=thread.customer.id,
                            sessionmaker=sessionmaker,
                            self_org_id=self_org_id,
                            semaphore=semaphore,
                            result=result,
                            result_lock=result_lock,
                            dry_run=dry_run,
                            email_cache=email_cache,
                            org_cache=org_cache,
                        )
                    )
                )

                progress.advance(task_id)

                if limit is not None and result.threads_seen >= limit:
                    break

    return result


@cli.command()
@typer_async
async def backfill(
    dry_run: bool = typer.Option(
        True, help="Print what would be done without calling Plain"
    ),
    limit: int | None = typer.Option(None, help="Maximum number of threads to process"),
    concurrency: int = typer.Option(5, help="Number of threads to process in parallel"),
    page_size: int = typer.Option(50, help="Plain threads page size"),
    customer_id: list[str] = typer.Option(
        [],
        "--customer-id",
        help="Restrict to specific Plain customer IDs (repeat for multiple)",
    ),
) -> None:
    """Backfill Plain thread tenants for threads missing a tenant."""
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
        result = await run_backfill(
            sessionmaker=sessionmaker,
            dry_run=dry_run,
            limit=limit,
            concurrency=concurrency,
            page_size=page_size,
            customer_ids=customer_id or None,
        )

        typer.echo(
            f"\nDone: {result.threads_seen} threads without tenant scanned, "
            f"{result.threads_updated} updated, "
            f"{result.threads_skipped_no_email} skipped (no email), "
            f"{result.threads_skipped_no_org} skipped (no matching org), "
            f"{result.threads_skipped_ambiguous} skipped (ambiguous), "
            f"{result.thread_errors} errors"
        )
        if result.error_details:
            typer.echo("\nErrors:")
            for thread_id, operation, tb in result.error_details:
                typer.echo(f"\n  {operation} ({thread_id}):")
                for line in tb.rstrip().splitlines():
                    typer.echo(f"    {line}")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
