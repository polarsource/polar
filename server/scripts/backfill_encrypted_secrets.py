"""Encrypt the secrets written in plaintext before dual-write.

Covers webhook endpoint secrets, TOTP secrets, SSO client secrets and the
Discord tokens in customer and member OAuth accounts. Seat invitation tokens
live one day, so they need no backfill.

Dry-run by default (counts rows only). Pass --execute to write:

    uv run python -m scripts.backfill_encrypted_secrets --execute
"""

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any
from uuid import UUID

import typer
from sqlalchemy import ColumnElement, TextClause, func, select, text

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import (
    Customer,
    Member,
    OrganizationSSOConnection,
    TOTPEnrollment,
    WebhookEndpoint,
)
from polar.models.customer import CustomerOAuthAccount, CustomerOAuthPlatform
from polar.postgres import create_async_engine

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


async def _fill_webhook_endpoint(endpoint: WebhookEndpoint) -> None:
    assert endpoint.secret is not None
    endpoint.secret_encrypted = await WebhookEndpoint.encrypt_secret(
        endpoint.id, endpoint.secret
    )


async def _fill_totp_enrollment(enrollment: TOTPEnrollment) -> None:
    assert enrollment.secret is not None
    enrollment.secret_encrypted = await TOTPEnrollment.encrypt_secret(
        enrollment.id, enrollment.secret
    )


async def _fill_sso_connection(connection: OrganizationSSOConnection) -> None:
    connection.client_secret_encrypted = (
        await OrganizationSSOConnection.encrypt_client_secret(
            connection.id, connection.configuration.get("client_secret")
        )
    )


async def _fill_oauth_accounts(owner: Customer | Member) -> None:
    for account_key, data in owner.oauth_accounts.items():
        platform, _ = CustomerOAuthPlatform.parse_account_key(account_key)
        if platform.keeps_tokens and "access_token_encrypted" not in data:
            await owner.set_oauth_account(CustomerOAuthAccount(**data), platform)


def _plaintext_discord_tokens(table: str) -> TextClause:
    return text(
        "EXISTS (SELECT 1 FROM jsonb_each("
        f"{table}.oauth_accounts) AS account(key, value) "
        "WHERE account.key LIKE 'discord:%' "
        "AND account.value ? 'access_token' "
        "AND NOT account.value ? 'access_token_encrypted')"
    )


@dataclass
class Target:
    name: str
    model: Any
    needs_backfill: Callable[[], ColumnElement[bool] | TextClause]
    fill: Callable[[Any], Awaitable[None]]


TARGETS = [
    Target(
        "webhook_endpoints",
        WebhookEndpoint,
        lambda: WebhookEndpoint.secret_encrypted.is_(None),
        _fill_webhook_endpoint,
    ),
    Target(
        "totp_enrollments",
        TOTPEnrollment,
        lambda: TOTPEnrollment.secret_encrypted.is_(None),
        _fill_totp_enrollment,
    ),
    Target(
        "organization_sso_connections",
        OrganizationSSOConnection,
        lambda: (
            OrganizationSSOConnection.client_secret_encrypted.is_(None)
            & OrganizationSSOConnection.configuration.has_key("client_secret")
        ),
        _fill_sso_connection,
    ),
    Target(
        "customers",
        Customer,
        lambda: _plaintext_discord_tokens("customers"),
        _fill_oauth_accounts,
    ),
    Target(
        "members",
        Member,
        lambda: _plaintext_discord_tokens("members"),
        _fill_oauth_accounts,
    ),
]


async def _count_remaining(session: AsyncSession, target: Target) -> int:
    statement = (
        select(func.count()).select_from(target.model).where(target.needs_backfill())
    )
    return await session.scalar(statement) or 0


async def _backfill_target(
    session: AsyncSession, target: Target, batch_size: int, sleep_seconds: float
) -> int:
    """Walk the primary key forward, so the loop terminates and each batch
    skips the rows the previous ones filled. Encryption calls the key provider
    once per secret, hence Python rather than a set-based update."""
    total = 0
    after: UUID | None = None
    while True:
        statement = (
            select(target.model)
            .where(target.needs_backfill())
            .order_by(target.model.id)
            .limit(batch_size)
            .with_for_update(skip_locked=True)
        )
        if after is not None:
            statement = statement.where(target.model.id > after)
        rows = list((await session.execute(statement)).scalars().all())
        if not rows:
            return total

        await asyncio.gather(*(target.fill(row) for row in rows))
        after = rows[-1].id
        await session.commit()
        session.expunge_all()
        total += len(rows)
        typer.echo(f"{target.name}: {total} rows encrypted")

        if sleep_seconds > 0:
            await asyncio.sleep(sleep_seconds)


async def run_backfill(
    batch_size: int = 500,
    sleep_seconds: float = 0.1,
    dry_run: bool = False,
    session: AsyncSession | None = None,
) -> dict[str, int]:
    engine = None
    own_session = session is None
    if session is None:
        engine = create_async_engine("script")
        session = create_async_sessionmaker(engine)()

    results: dict[str, int] = {}
    try:
        for target in TARGETS:
            if dry_run:
                results[target.name] = await _count_remaining(session, target)
            else:
                results[target.name] = await _backfill_target(
                    session, target, batch_size, sleep_seconds
                )
            remaining = await _count_remaining(session, target)
            typer.echo(
                f"{target.name}: {results[target.name]} "
                f"{'to encrypt' if dry_run else 'encrypted'}, {remaining} remaining"
            )
        return results
    finally:
        if own_session:
            await session.close()
        if engine is not None:
            await engine.dispose()


@cli.command()
@typer_async
async def backfill(
    batch_size: int = typer.Option(
        500, min=1, help="Number of rows to process per batch"
    ),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
    execute: bool = typer.Option(
        False, "--execute", help="Write encrypted secrets; without it, only counts rows"
    ),
) -> None:
    """Encrypt the secrets written in plaintext before dual-write."""
    configure_script_logging()
    await run_backfill(
        batch_size=batch_size, sleep_seconds=sleep_seconds, dry_run=not execute
    )


if __name__ == "__main__":
    cli()
