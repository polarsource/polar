from uuid import UUID

import typer
from sqlalchemy import select

from polar.benefit.grant.repository import BenefitGrantRepository
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import BenefitGrant
from polar.postgres import create_async_engine

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


async def find_duplicates(
    session: AsyncSession, grant: BenefitGrant
) -> list[BenefitGrant]:
    """Find non-deleted grants sharing the same benefit, customer, scope and member.

    The scope is the (subscription_id, order_id) pair: subscription-based grants
    have subscription_id set with order_id NULL, while order-based grants have
    order_id set with subscription_id NULL. Both must match so that grants for
    two different subscriptions of the same customer+benefit (both order_id NULL)
    are not treated as duplicates of each other.

    The returned list includes ``grant`` itself, ordered so that the grant we
    want to keep comes first: granted grants before revoked/failed ones, then
    oldest first, with the id as a deterministic tie-breaker.
    """
    statement = (
        select(BenefitGrant)
        .where(
            BenefitGrant.benefit_id == grant.benefit_id,
            BenefitGrant.customer_id == grant.customer_id,
            BenefitGrant.subscription_id == grant.subscription_id,
            BenefitGrant.order_id == grant.order_id,
            BenefitGrant.member_id == grant.member_id,
            BenefitGrant.deleted_at.is_(None),
        )
        .order_by(
            BenefitGrant.granted_at.is_(None),  # granted (False) sort first
            BenefitGrant.created_at,
            BenefitGrant.id,
        )
    )
    return list(await session.scalars(statement))


@cli.command()
@typer_async
async def run(
    benefit_grant_id: UUID = typer.Argument(
        ..., help="The benefit grant id to deduplicate"
    ),
    dry_run: bool = typer.Option(
        True, help="Print what would be deleted without acting"
    ),
) -> None:
    """Deduplicate doubled benefit grants.

    Given a benefit grant id, finds other non-deleted grants for the same
    benefit, customer, scope (subscription + order) and member. If no duplicate
    exists, the script bails out without making any changes. Otherwise it keeps
    a single grant and soft-deletes the duplicates.
    """
    configure_script_logging()

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            repository = BenefitGrantRepository.from_session(session)

            grant = await repository.get_by_id(benefit_grant_id)
            if grant is None:
                typer.echo(
                    f"Benefit grant {benefit_grant_id} not found (or deleted).",
                    err=True,
                )
                raise typer.Exit(code=1)

            duplicates = await find_duplicates(session, grant)

            if len(duplicates) <= 1:
                typer.echo(
                    f"No duplicate found for benefit grant {benefit_grant_id} "
                    f"(benefit={grant.benefit_id} customer={grant.customer_id} "
                    f"subscription={grant.subscription_id} order={grant.order_id} "
                    f"member={grant.member_id}). Nothing to do."
                )
                return

            keeper, *to_delete = duplicates

            typer.echo(
                f"Found {len(duplicates)} grants for "
                f"benefit={grant.benefit_id} customer={grant.customer_id} "
                f"subscription={grant.subscription_id} order={grant.order_id} "
                f"member={grant.member_id}:\n"
            )
            typer.echo(
                f"  KEEP   {keeper.id} granted_at={keeper.granted_at} "
                f"revoked_at={keeper.revoked_at} created_at={keeper.created_at}"
            )
            for g in to_delete:
                typer.echo(
                    f"  DELETE {g.id} granted_at={g.granted_at} "
                    f"revoked_at={g.revoked_at} created_at={g.created_at}"
                )

            if dry_run:
                typer.echo(
                    f"\nDry run — would soft-delete {len(to_delete)} grant(s). "
                    f"Pass --no-dry-run to execute."
                )
                return

            for g in to_delete:
                await repository.soft_delete(g)
            await session.commit()
            typer.echo(f"\nSoft-deleted {len(to_delete)} duplicate grant(s).")

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
