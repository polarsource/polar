from collections.abc import Callable
from typing import Any

import typer
from sqlalchemy import ColumnElement, and_, func, or_, select, update
from sqlalchemy.orm import aliased

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


def _iso_date(value: ColumnElement[str]) -> ColumnElement[str]:
    """Reconstruct the ISO date from the legacy localized string (e.g.
    "July 30, 2026") that the reminder builders now emit as YYYY-MM-DD."""
    return func.to_char(func.to_date(value, "FMMonth FMDD, YYYY"), "YYYY-MM-DD")


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
    template: EmailTemplate, date_prop: str
) -> tuple[KeyExpr, ValidExpr]:
    def key(model: Any) -> ColumnElement[str]:
        return func.concat(
            f"{template}:",
            model.email_props["subscription"]["id"].as_string(),
            ":",
            _iso_date(model.email_props[date_prop].as_string()),
        )

    def valid(model: Any) -> ColumnElement[bool]:
        return and_(
            model.email_props["subscription"]["id"].as_string().isnot(None),
            model.email_props[date_prop].as_string().isnot(None),
        )

    return key, valid


_renewal_key, _renewal_valid = _subscription_date_key(
    EmailTemplate.subscription_renewal_reminder, "renewal_date"
)
_trial_key, _trial_valid = _subscription_date_key(
    EmailTemplate.subscription_trial_conversion_reminder, "conversion_date"
)

CONFIGS: list[tuple[EmailTemplate, KeyExpr, ValidExpr]] = [
    (EmailTemplate.payment_method_expiration_reminder, _card_key, _card_valid),
    (EmailTemplate.subscription_renewal_reminder, _renewal_key, _renewal_valid),
    (EmailTemplate.subscription_trial_conversion_reminder, _trial_key, _trial_valid),
]


async def run_backfill(
    *,
    batch_size: int = 5000,
    sleep_seconds: float = 0.1,
    dry_run: bool = True,
    session: AsyncSession | None = None,
) -> int:
    total = 0
    for template, key, valid in CONFIGS:
        src = aliased(EmailLog)
        other = aliased(EmailLog)

        # Only key the earliest not-yet-keyed row per (computed key, recipient)
        # group so any historical duplicate leaves the others NULL — excluded from
        # the partial unique index PR2 builds. A row is skipped if another row in
        # the group is already keyed (it occupies the target key, e.g. via the
        # new send path or a previous run) or is earlier. Membership is defined
        # over ALL sent rows in the group, so it stays stable as batches fill in.
        is_canonical = ~(
            select(other.id)
            .where(
                other.status == EmailLogStatus.sent,
                other.email_template == template,
                key(other) == key(src),
                other.to_email_addr == src.to_email_addr,
                or_(
                    other.deduplication_key.isnot(None),
                    other.created_at < src.created_at,
                    and_(
                        other.created_at == src.created_at,
                        other.id < src.id,
                    ),
                ),
            )
            .exists()
        )

        candidate_statement = select(src.id).where(
            src.status == EmailLogStatus.sent,
            src.email_template == template,
            src.deduplication_key.is_(None),
            valid(src),
            is_canonical,
        )

        if dry_run:
            count = await _count(
                select(func.count()).select_from(candidate_statement.subquery()),
                session,
            )
            typer.echo(f"[dry-run] {template}: {count} rows would be updated")
            total += count
            continue

        total += await run_batched_update(
            update(EmailLog)
            .values(deduplication_key=key(EmailLog))
            .where(EmailLog.id.in_(candidate_statement.limit(limit_bindparam()))),
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
