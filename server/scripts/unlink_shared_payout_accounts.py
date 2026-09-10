from uuid import UUID

import typer
from sqlalchemy import (
    ColumnElement,
    Select,
    and_,
    distinct,
    func,
    or_,
    select,
    tuple_,
    update,
)
from sqlalchemy.orm import aliased

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Order, Organization
from polar.models.organization import OrganizationStatus
from polar.postgres import create_async_engine

from .helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()

# Unlinking an organization someone is currently assessing changes the picture
# under the reviewer's eyes, so leave those alone whatever their claim.
SPARED_STATUSES = (
    OrganizationStatus.REVIEW,
    OrganizationStatus.SNOOZED,
)

Candidate = aliased(Organization, name="candidate")
Keeper = aliased(Organization, name="keeper")
Seller = aliased(Organization, name="seller")
Remaining = aliased(Organization, name="remaining")


def _shared_payout_account_ids() -> Select[tuple[UUID | None]]:
    """Payout accounts held by more than one live organization.

    Narrowing to these first keeps the per-organization checks below off the
    whole table.
    """
    return (
        select(Organization.payout_account_id)
        .where(
            Organization.payout_account_id.is_not(None),
            Organization.deleted_at.is_(None),
        )
        .group_by(Organization.payout_account_id)
        .having(func.count() > 1)
    )


def _sells(organization: type[Organization]) -> ColumnElement[bool]:
    return (
        select(Order.id)
        .where(
            Order.organization_id == organization.id,
            Order.paid,
            Order.deleted_at.is_(None),
        )
        .exists()
    )


def _account_has_seller() -> ColumnElement[bool]:
    return (
        select(Seller.id)
        .where(
            Seller.payout_account_id == Candidate.payout_account_id,
            Seller.deleted_at.is_(None),
            _sells(Seller),
        )
        # Nested two levels deep, this would otherwise pull `candidate` into its
        # own FROM and match any seller anywhere.
        .correlate(Candidate)
        .exists()
    )


def _unlinkable() -> tuple[ColumnElement[bool], ...]:
    return (
        Candidate.deleted_at.is_(None),
        Candidate.payout_account_id.in_(_shared_payout_account_ids()),
        Candidate.status.not_in(SPARED_STATUSES),
        ~_sells(Candidate),
    )


def _has_better_claim() -> ColumnElement[bool]:
    """Whether another organization on the account outranks the candidate.

    Taking payments beats everything. Where nobody on the account ever sold,
    age decides, so the account always keeps exactly one organization and the
    merchant never has to redo their Stripe onboarding.
    """
    return (
        select(Keeper.id)
        .where(
            Keeper.payout_account_id == Candidate.payout_account_id,
            Keeper.id != Candidate.id,
            Keeper.deleted_at.is_(None),
            or_(
                _sells(Keeper),
                and_(
                    ~_account_has_seller(),
                    tuple_(Keeper.created_at, Keeper.id)
                    < tuple_(Candidate.created_at, Candidate.id),
                ),
            ),
        )
        .exists()
    )


def _candidates() -> Select[tuple[UUID]]:
    return select(Candidate.id).where(*_unlinkable(), _has_better_claim())


@cli.command()
@typer_async
async def unlink_shared_payout_accounts(
    execute: bool = typer.Option(
        False, help="Actually unlink the organizations (default: dry-run)"
    ),
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    """Leave a shared payout account with a single organization.

    Stripe requires one connected account per website. The organization that
    takes payments keeps the account; where no organization on it ever sold, the
    oldest keeps it. Everything else is unlinked, except organizations under
    review or snoozed.

    Accounts where several organizations sell are left alone: resolving those
    means asking a merchant to onboard a second account.
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
                    *_unlinkable(), _has_better_claim()
                )
            )
            still_shared = await session.scalar(
                select(func.count()).select_from(
                    select(Remaining.payout_account_id)
                    .where(
                        Remaining.deleted_at.is_(None),
                        Remaining.payout_account_id.in_(_shared_payout_account_ids()),
                        Remaining.id.not_in(_candidates()),
                    )
                    .group_by(Remaining.payout_account_id)
                    .having(func.count() > 1)
                    .subquery()
                )
            )

        typer.echo(
            f"{organizations} organization(s) to unlink across {accounts} payout account(s)."
        )
        typer.echo(
            f"{still_shared} payout account(s) would remain shared afterwards, "
            "by organizations that all sell."
        )

        if not execute:
            typer.echo("\nDry run — pass --execute to unlink them.")
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
