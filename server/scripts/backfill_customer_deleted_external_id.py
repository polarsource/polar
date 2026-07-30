import typer
from sqlalchemy import func, select, update

from polar.kit.db.postgres import AsyncSession
from polar.models import Customer
from polar.models.customer import EXTERNAL_ID_METADATA_KEY

from .helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()


async def run_backfill(
    batch_size: int = 5000,
    sleep_seconds: float = 0.1,
    session: AsyncSession | None = None,
) -> int:
    """
    Free the ``external_id`` of deleted customers that still hold one.

    Customers deleted with ``anonymize=true`` kept their ``external_id``, and the
    unique constraint on ``(organization_id, external_id)`` doesn't account for
    ``deleted_at``. Those external IDs are locked forever: the organization can't
    recreate a customer with the same one, and ``external_id`` is immutable. This
    moves the value into ``user_metadata``, exactly like the deletion code now
    does, keeping it readable through ``Customer.saved_external_id``.

    The predicate also matches customers deleted before ``soft_delete()`` started
    clearing the column, and it excludes rows this script has already handled —
    which gives the batched loop its termination condition and makes the script
    safe to rerun. Clearing a column can't violate a unique constraint, and no
    live customer can hold the same value (the constraint guarantees it), so this
    never conflicts.
    """
    batch = (
        select(Customer.id)
        .where(
            Customer.deleted_at.is_not(None),
            Customer.external_id.is_not(None),
        )
        .order_by(Customer.id)
        .limit(limit_bindparam())
    )
    update_statement = (
        update(Customer)
        .where(Customer.id.in_(batch))
        .values(
            # Every assignment reads the row as it was before the update, so
            # `external_id` is still readable here while being cleared below.
            user_metadata=Customer.user_metadata.op("||")(
                func.jsonb_build_object(EXTERNAL_ID_METADATA_KEY, Customer.external_id)
            ),
            external_id=None,
        )
        .execution_options(synchronize_session=False)
    )
    return await run_batched_update(
        update_statement,
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
        session=session,
    )


@cli.command()
@typer_async
async def backfill(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    """Free the external_id of deleted customers that still hold one."""
    configure_script_logging()
    total_updated = await run_backfill(
        batch_size=batch_size, sleep_seconds=sleep_seconds
    )
    typer.echo(f"Updated {total_updated} customers")


if __name__ == "__main__":
    cli()
