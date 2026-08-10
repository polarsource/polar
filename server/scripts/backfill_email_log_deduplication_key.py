from collections.abc import Callable
from typing import Any

import typer
from sqlalchemy import ColumnElement, Select, and_, func, select, update

from polar.email.schemas import EmailTemplate
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models.email_log import EmailLog, EmailLogStatus
from polar.postgres import create_async_engine
from scripts.helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()

configure_script_logging()

KeyExpr = Callable[[Any], ColumnElement[str]]
ValidExpr = Callable[[Any], ColumnElement[bool]]


def _card_key(model: Any) -> ColumnElement[str]:
    metadata = model.email_props["payment_method"]["method_metadata"]
    return func.concat(
        f"{EmailTemplate.payment_method_expiration_reminder}:",
        model.email_props["payment_method"]["id"].as_string(),
        ":",
        metadata["exp_year"].as_string(),
        "-",
        metadata["exp_month"].as_string(),
    )


def _card_valid(model: Any) -> ColumnElement[bool]:
    metadata = model.email_props["payment_method"]["method_metadata"]
    return and_(
        model.email_props["payment_method"]["id"].as_string().isnot(None),
        metadata["exp_year"].as_string().isnot(None),
        metadata["exp_month"].as_string().isnot(None),
    )


def _subscription_date_key(
    template: EmailTemplate, date_field: str
) -> tuple[KeyExpr, ValidExpr]:
    # The date comes from the serialized subscription's ISO datetime (the same
    # value the send-path key builder uses), so we take its YYYY-MM-DD prefix
    # rather than parsing the localized `renewal_date`/`conversion_date` string.
    def _iso_date(model: Any) -> ColumnElement[str]:
        return func.substring(
            model.email_props["subscription"][date_field].as_string(), 1, 10
        )

    def key(model: Any) -> ColumnElement[str]:
        return func.concat(
            f"{template}:",
            model.email_props["subscription"]["id"].as_string(),
            ":",
            _iso_date(model),
        )

    def valid(model: Any) -> ColumnElement[bool]:
        return and_(
            model.email_props["subscription"]["id"].as_string().isnot(None),
            model.email_props["subscription"][date_field].as_string().isnot(None),
        )

    return key, valid


_renewal_key, _renewal_valid = _subscription_date_key(
    EmailTemplate.subscription_renewal_reminder, "current_period_end"
)
_trial_key, _trial_valid = _subscription_date_key(
    EmailTemplate.subscription_trial_conversion_reminder, "trial_end"
)

CONFIGS: list[tuple[EmailTemplate, KeyExpr, ValidExpr]] = [
    (EmailTemplate.payment_method_expiration_reminder, _card_key, _card_valid),
    (EmailTemplate.subscription_renewal_reminder, _renewal_key, _renewal_valid),
    (EmailTemplate.subscription_trial_conversion_reminder, _trial_key, _trial_valid),
]


def _canonical_ids(
    template: EmailTemplate, key: KeyExpr, valid: ValidExpr
) -> Select[tuple[Any]]:
    """Select the id of the row to key per (computed key, recipient) group.

    A single window pass over the template's sent rows (no correlated subquery,
    so it scales to a large `email_logs`): pick the earliest row in each group
    (`rn == 1`), but only when the group has no already-keyed row — that row
    occupies the target key (from the new send path or a previous run), so the
    rest stay NULL and are excluded from the partial unique index PR2 builds.
    """
    partition = (key(EmailLog), EmailLog.to_email_addr)
    ranked = (
        select(
            EmailLog.id.label("id"),
            func.row_number()
            .over(partition_by=partition, order_by=(EmailLog.created_at, EmailLog.id))
            .label("rank"),
            func.bool_or(EmailLog.deduplication_key.isnot(None))
            .over(partition_by=partition)
            .label("group_keyed"),
        )
        .where(
            EmailLog.status == EmailLogStatus.sent,
            EmailLog.email_template == template,
            valid(EmailLog),
        )
        .subquery()
    )
    # rank == 1 is the earliest row in the group; group_keyed is false only when
    # no row in the group is keyed, so that earliest row is guaranteed NULL.
    return select(ranked.c.id).where(
        ranked.c.rank == 1,
        ranked.c.group_keyed.is_(False),
    )


async def run_backfill(
    *,
    batch_size: int = 5000,
    sleep_seconds: float = 0.1,
    dry_run: bool = True,
    session: AsyncSession | None = None,
) -> int:
    total = 0
    for template, key, valid in CONFIGS:
        canonical_ids = _canonical_ids(template, key, valid)

        if dry_run:
            count = await _count(
                select(func.count()).select_from(canonical_ids.subquery()),
                session,
            )
            typer.echo(f"[dry-run] {template}: {count} rows would be updated")
            total += count
            continue

        total += await run_batched_update(
            update(EmailLog)
            .values(deduplication_key=key(EmailLog))
            .where(EmailLog.id.in_(canonical_ids.limit(limit_bindparam()))),
            batch_size=batch_size,
            sleep_seconds=sleep_seconds,
            session=session,
        )

    if dry_run:
        typer.echo(
            f"[dry-run] {total} rows would be updated in total. "
            "Re-run with --execute to apply."
        )
    return total


async def _count(statement: Any, session: AsyncSession | None) -> int:
    if session is not None:
        return (await session.execute(statement)).scalar_one()
    engine = create_async_engine("script")
    try:
        sessionmaker = create_async_sessionmaker(engine)
        async with sessionmaker() as read_session:
            return (await read_session.execute(statement)).scalar_one()
    finally:
        await engine.dispose()


@cli.command()
@typer_async
async def backfill_email_log_deduplication_key(
    execute: bool = typer.Option(
        False, "--execute", help="Apply changes. Without it, runs as a dry run."
    ),
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    await run_backfill(
        batch_size=batch_size, sleep_seconds=sleep_seconds, dry_run=not execute
    )


if __name__ == "__main__":
    cli()
