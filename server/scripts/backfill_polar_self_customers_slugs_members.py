import uuid
from dataclasses import dataclass

import structlog
import typer
from rich.progress import Progress
from sqlalchemy import select
from sqlalchemy.orm import attributes, selectinload

from polar.config import settings
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Customer, Organization, User
from polar.models.member import Member
from polar.postgres import AsyncSession, create_async_engine

from .helper import configure_script_logging, typer_async

log = structlog.get_logger()

cli = typer.Typer()


@dataclass
class BackfillResult:
    slugs_updated: int = 0
    slugs_already_set: int = 0
    member_names_updated: int = 0
    member_names_already_correct: int = 0
    member_user_not_found: int = 0
    member_no_external_id: int = 0
    invalid_external_id: int = 0
    organization_not_found: int = 0


def _derive_member_name(user: User) -> str:
    if user.full_name is not None:
        return user.full_name
    return user.email.split("@", 1)[0]


BATCH_SIZE = 200


async def _load_self_customers(
    session: AsyncSession, self_org_id: uuid.UUID
) -> list[Customer]:
    statement = (
        select(Customer)
        .where(
            Customer.organization_id == self_org_id,
            Customer.external_id.is_not(None),
            Customer.deleted_at.is_(None),
        )
        .options(selectinload(Customer.members))
        .order_by(Customer.created_at)
    )
    result = await session.execute(statement)
    return list(result.scalars().unique().all())


async def _fix_member_names(
    session: AsyncSession,
    members: list[Member],
    result: BackfillResult,
    *,
    dry_run: bool,
) -> None:
    for member in members:
        if member.deleted_at is not None:
            continue
        if member.external_id is None:
            result.member_no_external_id += 1
            continue

        try:
            user_id = uuid.UUID(member.external_id)
        except ValueError:
            log.warning(
                "backfill.member.invalid_external_id",
                member_id=str(member.id),
                external_id=member.external_id,
            )
            result.invalid_external_id += 1
            continue

        user = await session.get(User, user_id)
        if user is None:
            log.warning(
                "backfill.member.user_not_found",
                member_id=str(member.id),
                user_id=str(user_id),
            )
            result.member_user_not_found += 1
            continue

        expected_name = _derive_member_name(user)
        if member.name == expected_name:
            result.member_names_already_correct += 1
            continue

        if dry_run:
            typer.echo(
                f"  Would update member {member.id} name "
                f"{member.name!r} -> {expected_name!r}"
            )
        else:
            member.name = expected_name
            session.add(member)
        result.member_names_updated += 1


async def run_backfill(
    *,
    session: AsyncSession,
    dry_run: bool,
    limit: int | None,
) -> BackfillResult:
    result = BackfillResult()

    self_org_id = uuid.UUID(settings.POLAR_ORGANIZATION_ID)

    typer.echo("Loading Polar self customers...")
    customers = await _load_self_customers(session, self_org_id)
    if limit is not None:
        customers = customers[:limit]
    typer.echo(f"Found {len(customers)} customers")

    processed_in_batch = 0

    with Progress() as progress:
        task = progress.add_task(
            "[cyan]Backfilling slugs and member emails...", total=len(customers)
        )

        for customer in customers:
            assert customer.external_id is not None
            customer_dirty = False

            try:
                organization_id = uuid.UUID(customer.external_id)
            except ValueError:
                log.warning(
                    "backfill.customer.invalid_external_id",
                    customer_id=str(customer.id),
                    external_id=customer.external_id,
                )
                result.invalid_external_id += 1
                progress.advance(task)
                continue

            organization = await session.get(Organization, organization_id)
            if organization is None:
                log.warning(
                    "backfill.organization_not_found",
                    customer_id=str(customer.id),
                    organization_id=str(organization_id),
                )
                result.organization_not_found += 1
            else:
                existing = customer.user_metadata.get("slug")
                if existing == organization.slug:
                    result.slugs_already_set += 1
                else:
                    if dry_run:
                        typer.echo(
                            f"  Would set slug={organization.slug!r} on customer "
                            f"{customer.id}"
                        )
                    else:
                        customer.user_metadata = {
                            **customer.user_metadata,
                            "slug": organization.slug,
                        }
                        attributes.flag_modified(customer, "user_metadata")
                        customer_dirty = True
                    result.slugs_updated += 1

            await _fix_member_names(
                session, list(customer.members), result, dry_run=dry_run
            )

            if customer_dirty:
                session.add(customer)

            processed_in_batch += 1
            if not dry_run and processed_in_batch >= BATCH_SIZE:
                await session.commit()
                processed_in_batch = 0

            progress.advance(task)

        if not dry_run and processed_in_batch > 0:
            await session.commit()

    return result


@cli.command()
@typer_async
async def backfill(
    dry_run: bool = typer.Option(
        True, help="Print what would be done without writing changes"
    ),
    limit: int | None = typer.Option(
        None, help="Maximum number of customers to process"
    ),
) -> None:
    """Backfill organization slug into Polar self customers' user_metadata,
    and repair member names from the linked User."""
    configure_script_logging()

    if not settings.POLAR_ORGANIZATION_ID:
        typer.echo("POLAR_ORGANIZATION_ID is not configured, aborting.")
        raise typer.Exit(1)

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            result = await run_backfill(session=session, dry_run=dry_run, limit=limit)

        typer.echo(
            f"\nDone:\n"
            f"  Slugs:   {result.slugs_updated} updated, "
            f"{result.slugs_already_set} already set, "
            f"{result.organization_not_found} organization not found\n"
            f"  Members: {result.member_names_updated} names updated, "
            f"{result.member_names_already_correct} already correct, "
            f"{result.member_user_not_found} user not found, "
            f"{result.member_no_external_id} skipped (no external_id), "
            f"{result.invalid_external_id} invalid external_id"
        )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
