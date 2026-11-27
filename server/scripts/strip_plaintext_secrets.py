"""
Remove the plaintext secrets left in JSONB once their encrypted copy exists.

- SSO connections: `configuration.client_secret`, when `client_secret_encrypted`
  is set.
- Customer and member OAuth accounts: `access_token` and `refresh_token`, on
  Discord entries that carry their encrypted copy and on every GitHub entry
  (GitHub tokens are not kept).

Discord entries without an encrypted copy keep their plaintext and are counted
apart: run `backfill_encrypted_secrets` for them first.

Usage:
    cd server

    # Dry-run (default) — count the rows to strip:
    uv run python -m scripts.strip_plaintext_secrets

    # Execute (batched):
    uv run python -m scripts.strip_plaintext_secrets --execute
"""

from typing import Any

import structlog
import typer
from rich.console import Console
from sqlalchemy import (
    ColumnElement,
    Select,
    TextClause,
    Update,
    func,
    select,
    text,
    update,
)

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Customer, Member, OrganizationSSOConnection
from polar.postgres import create_async_engine
from scripts.helper import (
    configure_script_console_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()
console = Console()
log = structlog.get_logger()

configure_script_console_logging()

STRIPPABLE_ACCOUNT = (
    "(account.key LIKE 'github:%' OR account.value ? 'access_token_encrypted')"
)
PLAINTEXT_TOKEN = "(account.value ? 'access_token' OR account.value ? 'refresh_token')"


def _sso_plaintext() -> ColumnElement[bool]:
    return OrganizationSSOConnection.configuration.has_key(
        "client_secret"
    ) & OrganizationSSOConnection.client_secret_encrypted.is_not(None)


def _oauth_accounts_plaintext(table: str) -> TextClause:
    return text(
        f"EXISTS (SELECT 1 FROM jsonb_each({table}.oauth_accounts) "
        f"AS account(key, value) WHERE {STRIPPABLE_ACCOUNT} AND {PLAINTEXT_TOKEN})"
    )


def _oauth_accounts_unencrypted(table: str) -> TextClause:
    return text(
        f"EXISTS (SELECT 1 FROM jsonb_each({table}.oauth_accounts) "
        "AS account(key, value) WHERE account.key LIKE 'discord:%' "
        "AND account.value ? 'access_token' "
        "AND NOT account.value ? 'access_token_encrypted')"
    )


def _oauth_accounts_stripped(table: str) -> TextClause:
    return text(
        "(SELECT jsonb_object_agg(account.key, CASE "
        f"WHEN {STRIPPABLE_ACCOUNT} "
        "THEN account.value - 'access_token' - 'refresh_token' "
        "ELSE account.value END) "
        f"FROM jsonb_each({table}.oauth_accounts) AS account(key, value))"
    )


def sso_statement() -> Update:
    subquery = (
        select(OrganizationSSOConnection.id)
        .where(_sso_plaintext())
        .order_by(OrganizationSSOConnection.id)
        .limit(limit_bindparam())
        .scalar_subquery()
    )
    return (
        update(OrganizationSSOConnection)
        .where(OrganizationSSOConnection.id.in_(subquery))
        .values(configuration=text("configuration - 'client_secret'"))
        .execution_options(synchronize_session=False)
    )


def oauth_accounts_statement(model: type[Customer | Member]) -> Update:
    table = model.__tablename__
    subquery = (
        select(model.id)
        .where(_oauth_accounts_plaintext(table))
        .order_by(model.id)
        .limit(limit_bindparam())
        .scalar_subquery()
    )
    return (
        update(model)
        .where(model.id.in_(subquery))
        .values({model._oauth_accounts: _oauth_accounts_stripped(table)})
        .execution_options(synchronize_session=False)
    )


def _count(model: Any, clause: ColumnElement[bool] | TextClause) -> Select[int]:
    return select(func.count()).select_from(model).where(clause)


@cli.command()
@typer_async
async def strip(
    execute: bool = typer.Option(False, help="Actually strip (default: dry-run)"),
    batch_size: int = typer.Option(
        1000, min=1, help="Number of rows to process per batch"
    ),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    targets: list[tuple[str, Any, ColumnElement[bool] | TextClause, Update]] = [
        (
            "organization_sso_connections",
            OrganizationSSOConnection,
            _sso_plaintext(),
            sso_statement(),
        ),
        *(
            (
                model.__tablename__,
                model,
                _oauth_accounts_plaintext(model.__tablename__),
                oauth_accounts_statement(model),
            )
            for model in (Customer, Member)
        ),
    ]

    try:
        async with sessionmaker() as session:
            for name, model, clause, _ in targets:
                count = (await session.execute(_count(model, clause))).scalar_one()
                console.print(f"{name}: [bold]{count}[/bold] row(s) to strip")
            for model in (Customer, Member):
                unencrypted = (
                    await session.execute(
                        _count(model, _oauth_accounts_unencrypted(model.__tablename__))
                    )
                ).scalar_one()
                console.print(
                    f"{model.__tablename__}: [bold]{unencrypted}[/bold] row(s) "
                    "with Discord tokens not yet encrypted (left untouched)"
                )

        if not execute:
            console.print("[yellow]Dry-run — use --execute to strip them.")
            return

        for name, _, _, statement in targets:
            console.rule(f"[bold]{name}")
            rows_updated = await run_batched_update(
                statement, batch_size=batch_size, sleep_seconds=sleep_seconds
            )
            log.info("strip.complete", table=name, rowcount=rows_updated)
            console.print(f"[green]Stripped {rows_updated} {name} row(s).")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
