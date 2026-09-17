"""Find endpoints marked as Standard Webhooks whose secret can't sign that way."""

import binascii
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, cast
from uuid import UUID

import typer
from rich.console import Console
from rich.table import Table
from sqlalchemy import CursorResult, select, update
from sqlalchemy.orm import joinedload
from standardwebhooks.webhooks import EmptyWebhookSecretError
from standardwebhooks.webhooks import Webhook as StandardWebhook

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import WebhookEndpoint
from polar.postgres import create_async_engine
from polar.webhook.constants import (
    WEBHOOK_STANDARD_SIGNATURE_CUTOFF,
    uses_standard_webhook_signature,
)
from scripts.helper import configure_script_logging, typer_async

cli = typer.Typer()
console = Console()


class InvalidStandardSecret(Exception):
    title: str


class NotBase64(InvalidStandardSecret):
    title = "Not decodable as base64, so signing raises before delivery"


class EmptyKey(InvalidStandardSecret):
    title = "Decodes to an empty key, so signing raises before delivery"


@dataclass(frozen=True)
class InvalidSecretFinding:
    endpoint_id: UUID
    organization_slug: str
    url: str
    enabled: bool
    invalid_reason: InvalidStandardSecret


async def load_marked_standard(session: AsyncSession) -> list[WebhookEndpoint]:
    """Endpoints the dashboard reports as signing with Standard Webhooks.

    The SQL predicate only narrows; `uses_standard_webhook_signature` decides,
    so the audited set is the same one the dashboard shows and `sign_webhook`
    acts on rather than a third opinion about what "marked" means.
    """
    statement = (
        select(WebhookEndpoint)
        .where(
            WebhookEndpoint.deleted_at.is_(None),
            WebhookEndpoint.secret_generated_at >= WEBHOOK_STANDARD_SIGNATURE_CUTOFF,
        )
        .options(joinedload(WebhookEndpoint.organization))
        .order_by(WebhookEndpoint.secret_generated_at)
    )
    result = await session.execute(statement)
    return [
        endpoint
        for endpoint in result.unique().scalars().all()
        if uses_standard_webhook_signature(endpoint.secret_generated_at)
    ]


async def clear_secret_generated_at(
    session: AsyncSession, endpoint_ids: Sequence[UUID]
) -> int:
    """Return the endpoints to legacy signing."""
    statement = (
        update(WebhookEndpoint)
        .where(WebhookEndpoint.id.in_(endpoint_ids))
        .values(secret_generated_at=None)
    )
    result = await session.execute(statement)
    return cast(CursorResult[Any], result).rowcount


def validate_secret(secret: str) -> None:
    try:
        StandardWebhook(secret)
    except binascii.Error as e:
        raise NotBase64() from e
    except EmptyWebhookSecretError as e:
        raise EmptyKey() from e


def audit(endpoints: list[WebhookEndpoint]) -> list[InvalidSecretFinding]:
    invalid_secrets: list[InvalidSecretFinding] = []
    for endpoint in endpoints:
        try:
            validate_secret(endpoint.secret)
        except InvalidStandardSecret as e:
            invalid_secrets.append(
                InvalidSecretFinding(
                    endpoint_id=endpoint.id,
                    organization_slug=endpoint.organization.slug,
                    url=endpoint.url,
                    enabled=endpoint.enabled,
                    invalid_reason=e,
                )
            )
    return invalid_secrets


def render(findings: list[InvalidSecretFinding], total: int, *, verbose: bool) -> None:
    console.print(
        f"Endpoints mistakenly marked as Standard Webhooks: {len(findings)} of {total}"
    )
    if not findings:
        return

    by_reason: dict[type[InvalidStandardSecret], list[InvalidSecretFinding]] = {}
    for finding in findings:
        by_reason.setdefault(type(finding.invalid_reason), []).append(finding)

    for reason, group in by_reason.items():
        table = Table(title=reason.title, title_justify="left")
        table.add_column("Organization")
        table.add_column("Endpoint")
        table.add_column("Enabled")
        for finding in group:
            table.add_row(
                finding.organization_slug,
                str(finding.endpoint_id),
                "yes" if finding.enabled else "no",
            )
        console.print(table)

        if verbose:
            for finding in group:
                console.print(f"[dim]{finding.endpoint_id}  {finding.url}")

    delivering = [f for f in findings if f.enabled]
    console.print(f"\n{len(delivering)} of them are enabled and still delivering.")


@cli.command()
@typer_async
async def main(
    verbose: bool = typer.Option(False, "--verbose", help="Also print endpoint URLs."),
    correct: bool = typer.Option(
        False,
        "--correct",
        help=(
            "Clear secret_generated_at on the endpoints reported, "
            "returning them to legacy signing."
        ),
    ),
) -> None:
    """Audit endpoints marked as Standard Webhooks for unusable secrets."""
    configure_script_logging()
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            endpoints = await load_marked_standard(session)
            findings = audit(endpoints)
            render(findings, len(endpoints), verbose=verbose)

            if not correct:
                if findings:
                    console.print(
                        "\n[dim]Pass --correct to clear secret_generated_at on these."
                    )
                return

            if not findings:
                return

            corrected = await clear_secret_generated_at(
                session, [finding.endpoint_id for finding in findings]
            )
            await session.commit()
            console.print(
                f"\n[green]Returned {corrected} endpoint(s) to legacy signing."
            )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
