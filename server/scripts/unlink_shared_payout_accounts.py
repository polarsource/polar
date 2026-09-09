from uuid import UUID

import typer
from sqlalchemy import ColumnElement, Select, distinct, func, or_, select, update
from sqlalchemy.orm import aliased

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Order, Organization
from polar.models.order import OrderStatus
from polar.models.organization import OrganizationStatus
from polar.postgres import create_async_engine

from .helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()

# An organization in one of these statuses is either live or waiting on a
# decision, so it keeps the payout account it points at.
KEEPER_STATUSES = (
    OrganizationStatus.ACTIVE,
    OrganizationStatus.REVIEW,
    OrganizationStatus.SNOOZED,
)

Candidate = aliased(Organization, name="candidate")
Keeper = aliased(Organization, name="keeper")
Sibling = aliased(Organization, name="sibling")


def _sells(organization: type[Organization]) -> ColumnElement[bool]:
    return (
        select(Order.id)
        .where(
            Order.organization_id == organization.id,
            Order.status.in_(OrderStatus.paid_statuses()),
            Order.deleted_at.is_(None),
        )
        .exists()
    )


def _unlinkable() -> tuple[ColumnElement[bool], ...]:
    return (
        Candidate.deleted_at.is_(None),
        Candidate.payout_account_id.is_not(None),
        Candidate.status.not_in(KEEPER_STATUSES),
        ~_sells(Candidate),
    )


def _is_shared() -> ColumnElement[bool]:
    return (
        select(Sibling.id)
        .where(
            Sibling.payout_account_id == Candidate.payout_account_id,
            Sibling.id != Candidate.id,
            Sibling.deleted_at.is_(None),
        )
        .exists()
    )


def _has_keeper() -> ColumnElement[bool]:
    return (
        select(Keeper.id)
        .where(
            Keeper.payout_account_id == Candidate.payout_account_id,
            Keeper.id != Candidate.id,
            Keeper.deleted_at.is_(None),
            or_(Keeper.status.in_(KEEPER_STATUSES), _sells(Keeper)),
        )
        .exists()
    )


def _candidates() -> Select[tuple[UUID]]:
    return select(Candidate.id).where(*_unlinkable(), _has_keeper())


@cli.command()
@typer_async
async def unlink_shared_payout_accounts(
    dry_run: bool = typer.Option(
        True, help="Report what would be unlinked without writing"
    ),
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    """Give back every payout account shared by more than one organization.

    Stripe requires one connected account per website. An organization loses the
    account it shares when it has never taken a payment and is not live or under
    review, and only when another organization on that account keeps it — so the
    merchant who completed the Stripe onboarding never loses their account.
    """
    configure_script_logging()

    engine = create_async_engine("script")
    try:
        sessionmaker = create_async_sessionmaker(engine)
        async with sessionmaker() as session:
            organizations = await session.scalar(
                select(func.count()).select_from(_candidates().subquery())
            )
            accounts = await session.scalar(
                select(func.count(distinct(Candidate.payout_account_id))).where(
                    *_unlinkable(), _has_keeper()
                )
            )
            without_keeper = await session.scalar(
                select(func.count(distinct(Candidate.payout_account_id))).where(
                    *_unlinkable(), _is_shared(), ~_has_keeper()
                )
            )

        typer.echo(
            f"{organizations} organization(s) to unlink across {accounts} payout account(s)."
        )
        typer.echo(
            f"{without_keeper} shared payout account(s) left untouched: "
            "no organization on them qualifies as a keeper."
        )

        if dry_run:
            typer.echo("\nDry run — pass --no-dry-run to execute.")
            return

        updated = await run_batched_update(
            (
                update(Organization)
                .values(payout_account_id=None)
                .where(
                    Organization.id.in_(
                        _candidates()
                        .order_by(Candidate.id)
                        .limit(limit_bindparam())
                        .scalar_subquery()
                    )
                )
            ),
            batch_size=batch_size,
            sleep_seconds=sleep_seconds,
        )
        typer.echo(f"Unlinked {updated} organization(s).")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
