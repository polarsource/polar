"""Invite an organization to the Polar Startup Program.

Resolves the Polar-for-Polar customer for the given organization (the customer
in Polar's own organization whose ``external_id`` is the organization id) and
eagerly creates its dedicated 100% / 12 month / single-use discount on the
Scale plan. The customer's status is then derived from that discount.

Usage:

    uv run python -m scripts.startup_program_mark_invited ORGANIZATION_ID
    uv run python -m scripts.startup_program_mark_invited ORGANIZATION_ID --no-dry-run
"""

import uuid

import typer

from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.kit.db.postgres import create_async_sessionmaker
from polar.postgres import AsyncSession, create_async_engine
from polar.startup_program.service import startup_program as startup_program_service

from .helper import configure_script_console_logging, typer_async

cli = typer.Typer()


async def _mark_invited(
    session: AsyncSession, *, organization_id: uuid.UUID, dry_run: bool
) -> None:
    polar_organization_id = uuid.UUID(settings.POLAR_ORGANIZATION_ID)
    customer_repository = CustomerRepository.from_session(session)
    customer = await customer_repository.get_by_external_id_and_organization(
        str(organization_id), polar_organization_id
    )
    if customer is None:
        typer.echo(
            f"No Polar customer found for organization {organization_id} "
            f"(external_id) in Polar org {polar_organization_id}."
        )
        raise typer.Exit(1)

    if dry_run:
        typer.echo(
            f"Would invite customer {customer.id} ({customer.name or customer.email}) "
            "and create a Scale discount."
        )
        return

    discount = await startup_program_service.mark_invited(session, customer)
    await session.commit()
    typer.echo(
        f"Invited customer {customer.id}. "
        f"Created discount {discount.id} ({discount.name})."
    )


@cli.command()
@typer_async
async def mark_invited(
    organization_id: uuid.UUID = typer.Argument(
        ..., help="Organization id to invite to the Startup Program"
    ),
    dry_run: bool = typer.Option(
        True, help="Print what would be done without writing anything"
    ),
) -> None:
    """Invite an organization to the Startup Program."""
    configure_script_console_logging()

    if not settings.STARTUP_PROGRAM_ENABLED:
        typer.echo(
            "POLAR_ORGANIZATION_ID or POLAR_SCALE_PRODUCT_ID is not configured, "
            "aborting."
        )
        raise typer.Exit(1)

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    try:
        async with sessionmaker() as session:
            await _mark_invited(
                session, organization_id=organization_id, dry_run=dry_run
            )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
