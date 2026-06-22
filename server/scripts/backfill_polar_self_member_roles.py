import uuid

import typer
from sqlalchemy import Select, String, and_, cast, select, update

from polar.config import settings
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Customer, UserOrganization
from polar.models.member import Member, MemberRole
from polar.models.user_organization import OrganizationRole
from polar.postgres import AsyncSession, create_async_engine

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


def _members_to_upgrade_statement(self_org_id: uuid.UUID) -> Select[tuple[uuid.UUID]]:
    return (
        select(Member.id)
        .join(Customer, Member.customer_id == Customer.id)
        .join(
            UserOrganization,
            and_(
                cast(UserOrganization.organization_id, String) == Customer.external_id,
                cast(UserOrganization.user_id, String) == Member.external_id,
            ),
        )
        .where(
            Customer.organization_id == self_org_id,
            Customer.deleted_at.is_(None),
            Member.deleted_at.is_(None),
            Member.external_id.is_not(None),
            Member.role == MemberRole.member,
            UserOrganization.deleted_at.is_(None),
            UserOrganization.role.in_([OrganizationRole.owner, OrganizationRole.admin]),
        )
    )


async def run_backfill(*, session: AsyncSession, dry_run: bool) -> int:
    self_org_id = uuid.UUID(settings.POLAR_ORGANIZATION_ID)
    statement = _members_to_upgrade_statement(self_org_id)
    member_ids = [row[0] for row in (await session.execute(statement)).all()]

    if member_ids and not dry_run:
        await session.execute(
            update(Member)
            .where(Member.id.in_(member_ids))
            .values(role=MemberRole.billing_manager)
        )
        await session.commit()

    return len(member_ids)


@cli.command()
@typer_async
async def backfill(
    dry_run: bool = typer.Option(
        True, help="Print what would be done without writing changes"
    ),
) -> None:
    """Upgrade mirrored Polar self members for org owners/admins to billing_manager."""
    configure_script_logging()

    if not settings.POLAR_ORGANIZATION_ID:
        typer.echo("POLAR_ORGANIZATION_ID is not configured, aborting.")
        raise typer.Exit(1)

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            count = await run_backfill(session=session, dry_run=dry_run)

        verb = "Would upgrade" if dry_run else "Upgraded"
        typer.echo(f"{verb} {count} members to billing_manager")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
