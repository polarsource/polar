import traceback
import uuid
from dataclasses import dataclass, field

import dramatiq
import structlog
import typer
from rich.progress import Progress
from sqlalchemy import String, cast, select

from polar import tasks  # noqa: F401
from polar.config import settings
from polar.kit.db.postgres import create_async_sessionmaker
from polar.member.repository import MemberRepository
from polar.models import Account, Customer, Member, Organization, User
from polar.models.member import MemberRole
from polar.postgres import AsyncSession, create_async_engine
from polar.redis import Redis, create_redis
from polar.worker import JobQueueManager

from .helper import configure_script_logging, typer_async

log = structlog.get_logger()
cli = typer.Typer()


@dataclass
class BackfillResult:
    drifted: int = 0
    transferred: int = 0
    member_created_and_promoted: int = 0
    errors: int = 0
    error_details: list[tuple[str, str, str]] = field(default_factory=list)


async def _load_drifted(
    session: AsyncSession, self_org_id: uuid.UUID, limit: int | None
) -> list[tuple[Organization, Customer, Member, User]]:
    statement = (
        select(Organization, Customer, Member, User)
        .join(Account, Account.id == Organization.account_id)
        .join(Customer, Customer.external_id == cast(Organization.id, String))
        .join(Member, Member.customer_id == Customer.id)
        .join(User, User.id == Account.admin_id)
        .where(
            Customer.organization_id == self_org_id,
            Customer.deleted_at.is_(None),
            Member.role == MemberRole.owner,
            Member.deleted_at.is_(None),
            Account.deleted_at.is_(None),
            Member.external_id != cast(Account.admin_id, String),
        )
        .order_by(Organization.created_at)
    )
    if limit is not None:
        statement = statement.limit(limit)

    result = await session.execute(statement)
    return list(result.unique().tuples().all())


async def _reconcile_one(
    session: AsyncSession,
    *,
    customer: Customer,
    current_owner: Member,
    admin_user: User,
    result: BackfillResult,
) -> None:
    member_repository = MemberRepository.from_session(session)
    admin_member = await member_repository.get_by_customer_id_and_external_id(
        customer.id, str(admin_user.id)
    )

    if admin_member is None:
        admin_member = await member_repository.create(
            Member(
                customer_id=customer.id,
                organization_id=customer.organization_id,
                email=admin_user.email,
                name=admin_user.public_name,
                external_id=str(admin_user.id),
                role=MemberRole.member,
            ),
            flush=True,
        )
        result.member_created_and_promoted += 1
    elif admin_member.role == MemberRole.owner:
        return
    else:
        result.transferred += 1

    await member_repository.transfer_ownership(
        current_owner=current_owner, new_owner=admin_member
    )


BATCH_SIZE = 50


async def run_backfill(
    *,
    session: AsyncSession,
    redis: Redis | None = None,
    dry_run: bool = False,
    limit: int | None = None,
) -> BackfillResult:
    result = BackfillResult()

    self_org = await session.get(
        Organization, uuid.UUID(settings.POLAR_ORGANIZATION_ID)
    )
    if self_org is None:
        raise RuntimeError(
            f"Polar self organization {settings.POLAR_ORGANIZATION_ID} not found"
        )

    typer.echo("Scanning for drifted polar-for-polar Member ownership...")
    drifted = await _load_drifted(session, self_org.id, limit)
    result.drifted = len(drifted)
    typer.echo(f"Found {result.drifted} drifted organizations")

    if not drifted:
        return result

    async def commit_and_flush() -> None:
        await session.commit()
        if redis is not None:
            await JobQueueManager.get().flush(dramatiq.get_broker(), redis)

    processed_in_batch = 0

    with Progress() as progress:
        task = progress.add_task("[cyan]Reconciling...", total=len(drifted))
        for organization, customer, current_owner, admin_user in drifted:
            if dry_run:
                typer.echo(
                    f"  Would reconcile {organization.slug} ({organization.id}): "
                    f"owner_member={current_owner.external_id} → "
                    f"admin={admin_user.id}"
                )
                progress.advance(task)
                continue

            try:
                async with session.begin_nested():
                    await _reconcile_one(
                        session,
                        customer=customer,
                        current_owner=current_owner,
                        admin_user=admin_user,
                        result=result,
                    )
            except Exception:
                result.errors += 1
                result.error_details.append(
                    (
                        str(organization.id),
                        organization.slug,
                        traceback.format_exc(),
                    )
                )

            processed_in_batch += 1
            if processed_in_batch >= BATCH_SIZE:
                await commit_and_flush()
                processed_in_batch = 0

            progress.advance(task)

        if not dry_run and processed_in_batch > 0:
            await commit_and_flush()

    return result


@cli.command()
@typer_async
async def backfill(
    dry_run: bool = typer.Option(True, help="Print what would be done without writing"),
    limit: int | None = typer.Option(
        None, help="Maximum number of organizations to process"
    ),
) -> None:
    """Reconcile polar-for-polar Member ownership with Account.admin_id."""
    configure_script_logging()

    if not settings.POLAR_SELF_ENABLED:
        typer.echo("Polar self is not configured, aborting.")
        raise typer.Exit(1)

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    redis = create_redis("app")

    try:
        async with (
            JobQueueManager.open(dramatiq.get_broker(), redis),
            sessionmaker() as session,
        ):
            result = await run_backfill(
                session=session, redis=redis, dry_run=dry_run, limit=limit
            )

        typer.echo(
            f"\nDone: drifted={result.drifted} "
            f"transferred={result.transferred} "
            f"created_and_promoted={result.member_created_and_promoted} "
            f"errors={result.errors}"
        )
        if result.error_details:
            typer.echo("\nErrors:")
            for org_id, slug, tb in result.error_details:
                typer.echo(f"\n  {slug} ({org_id}):")
                for line in tb.rstrip().splitlines():
                    typer.echo(f"    {line}")
    finally:
        await redis.aclose()  # type: ignore[attr-defined]
        await engine.dispose()


if __name__ == "__main__":
    cli()
