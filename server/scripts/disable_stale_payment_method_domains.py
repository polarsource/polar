"""
Sort every payment method domain on Stripe by whether Polar still needs it.

    uv run python -m scripts.disable_stale_payment_method_domains
    uv run python -m scripts.disable_stale_payment_method_domains --execute

Only `--execute` disables, and only the domains listed by organizations that can
no longer take payments. Stripe has no delete; a disabled domain comes back
when an organization registers it again.
"""

from collections import Counter, defaultdict
from enum import StrEnum

import typer
from rich.console import Console
from rich.table import Table
from sqlalchemy import func, select

from polar.config import settings
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Organization
from polar.organization.embed_hosts import parse_host_pattern
from polar.organization_domain.service import (
    organization_domain as organization_domain_service,
)
from polar.postgres import create_async_engine

from .helper import configure_script_logging, typer_async

cli = typer.Typer()

configure_script_logging()


class Case(StrEnum):
    polar = "Polar's own host"
    vouched = "Vouched for"
    unverified = "Listed by a paying org, no verified domain"
    inactive = "Listed only by orgs that cannot take payments"
    unlisted = "Listed by no org"
    disabled = "Already disabled"


@cli.command()
@typer_async
async def disable_stale_payment_method_domains(
    execute: bool = typer.Option(False, help="Disable the stale domains"),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    console = Console()
    polar_hosts = {settings.frontend_hostname}

    try:
        async with sessionmaker() as session:
            rows = await session.execute(
                select(
                    Organization.embed_hosts,
                    Organization.can_accept_payments,
                    Organization.deleted_at,
                ).where(func.jsonb_array_length(Organization.embed_hosts) > 0)
            )
            paying_by_host: dict[str, bool] = defaultdict(bool)
            for embed_hosts, can_accept_payments, deleted_at in rows:
                paying = deleted_at is None and can_accept_payments
                for entry in embed_hosts:
                    pattern = parse_host_pattern(entry)
                    if pattern is None or pattern.wildcard or pattern.scheme:
                        continue
                    paying_by_host[pattern.host] |= paying

            table = Table("Case", "Domain")
            counts: Counter[Case] = Counter()
            async for (
                payment_method_domain
            ) in await stripe_service.list_payment_method_domains():
                domain = payment_method_domain.domain_name
                if not payment_method_domain.enabled:
                    case = Case.disabled
                elif domain in polar_hosts:
                    case = Case.polar
                elif await organization_domain_service.is_payment_method_domain_vouched_for(
                    session, domain
                ):
                    case = Case.vouched
                elif domain not in paying_by_host:
                    case = Case.unlisted
                elif paying_by_host[domain]:
                    case = Case.unverified
                else:
                    case = Case.inactive

                counts[case] += 1
                table.add_row(case.value, domain)
                if execute and case == Case.inactive:
                    await stripe_service.update_payment_method_domain(
                        payment_method_domain.id, enabled=False
                    )

            console.print(table)
            for case in Case:
                console.print(f"{case.value}: {counts[case]}")
            if not execute:
                console.print(
                    f"Dry run: --execute would disable {counts[Case.inactive]} domains."
                )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
