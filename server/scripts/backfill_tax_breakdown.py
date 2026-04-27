import asyncio
from typing import Any, cast

import typer
from sqlalchemy import CursorResult, text

from scripts.helper import configure_script_logging, typer_async

cli = typer.Typer()

configure_script_logging()

_BACKFILL_SQL = """
    UPDATE {table}
    SET tax_breakdown = jsonb_build_array(
        jsonb_build_object(
            'rate_type', tax_rate->>'rate_type',
            'basis_points', (tax_rate->>'basis_points')::int,
            'display_name', tax_rate->>'display_name',
            'country', tax_rate->>'country',
            'state', tax_rate->>'state',
            'amount', tax_amount,
            'taxability_reason', taxability_reason
        )
    )
    WHERE id IN (
        SELECT id FROM {table}
        WHERE tax_breakdown IS NULL
          AND tax_rate IS NOT NULL
          AND taxability_reason IS NOT NULL
          AND tax_amount > 0
        ORDER BY id
        LIMIT :batch_size
    )
"""


async def _backfill_table(
    table: str,
    batch_size: int,
    sleep_seconds: float,
) -> None:
    from polar.kit.db.postgres import create_async_sessionmaker
    from polar.postgres import create_async_engine

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    total_updated = 0
    stmt = text(_BACKFILL_SQL.format(table=table))
    try:
        while True:
            async with sessionmaker() as session:
                result = await session.execute(stmt, {"batch_size": batch_size})
                await session.commit()
                rows_updated = cast(CursorResult[Any], result).rowcount
                if rows_updated == 0:
                    break
                total_updated += rows_updated
                print(f"  {table}: {total_updated} rows updated...")
            if sleep_seconds > 0:
                await asyncio.sleep(sleep_seconds)
    finally:
        await engine.dispose()

    print(f"  {table}: done ({total_updated} rows total).")


@cli.command()
@typer_async
async def backfill_all(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    for table in ("orders", "checkouts", "wallet_transactions"):
        print(f"Backfilling {table}...")
        await _backfill_table(table, batch_size, sleep_seconds)

    print("All backfills completed!")


if __name__ == "__main__":
    cli()
