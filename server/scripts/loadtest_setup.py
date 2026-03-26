#!/usr/bin/env python3
"""
Setup script for event ingestion load tests.

Creates test customers and meters in an existing organization,
then outputs environment variables for the load test.

Usage:
    uv run python scripts/loadtest_setup.py --organization-slug coldmail --num-customers 20
    uv run python scripts/loadtest_setup.py -o coldmail -n 20 -f .env.loadtest
"""

import asyncio
import os
from datetime import datetime

import dramatiq
import typer

import polar.tasks  # noqa: F401 - Import tasks to register all dramatiq actors
from polar.auth.models import AuthSubject
from polar.customer.schemas.customer import CustomerCreate
from polar.customer.service import customer as customer_service
from polar.kit.db.postgres import create_async_sessionmaker
from polar.meter.aggregation import AggregationFunction, PropertyAggregation
from polar.meter.filter import Filter, FilterClause, FilterConjunction, FilterOperator
from polar.meter.schemas import MeterCreate
from polar.meter.service import meter as meter_service
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession, create_async_engine
from polar.redis import create_redis
from polar.user_organization.service import UserOrganizationService
from polar.worker import JobQueueManager

cli = typer.Typer()


async def create_loadtest_data(
    session: AsyncSession,
    organization_slug: str,
    num_customers: int,
    output_file: str | None,
) -> None:
    """Create load test data in the specified organization."""
    # Get organization
    org_repository = OrganizationRepository.from_session(session)
    organization = await org_repository.get_by_slug(organization_slug)
    if organization is None:
        typer.echo(f"Error: Organization '{organization_slug}' not found", err=True)
        raise typer.Exit(1)

    # Get organization members for auth context
    user_org_service = UserOrganizationService()
    members = await user_org_service.list_by_org(session, organization.id)
    if not members:
        typer.echo("Error: Organization has no members", err=True)
        raise typer.Exit(1)

    admin_user = members[0].user
    auth_subject = AuthSubject(subject=admin_user, scopes=set(), session=None)

    typer.echo(
        f"Setting up load test data for organization: {organization.name}",
        err=True,
    )

    # Generate unique suffix for this run
    run_id = datetime.now().strftime("%Y%m%d%H%M%S")

    # Create customers with external IDs
    external_customer_ids = []
    for i in range(num_customers):
        external_id = f"loadtest-{run_id}-{i + 1}"
        customer = await customer_service.create(
            session=session,
            customer_create=CustomerCreate(
                email=f"{external_id}@polar.sh",
                name=f"Load Test Customer {i + 1}",
                external_id=external_id,
                organization_id=organization.id,
            ),
            auth_subject=auth_subject,
        )
        external_customer_ids.append(external_id)
        typer.echo(f"Created customer {i + 1}/{num_customers}", err=True)

    # Create meters matching Mycheli.AI pattern
    # Meter 1: Usage (pack)
    meter_pack = await meter_service.create(
        session=session,
        meter_create=MeterCreate(
            name=f"Usage (pack) - {run_id}",
            organization_id=organization.id,
            filter=Filter(
                conjunction=FilterConjunction.and_,
                clauses=[
                    FilterClause(
                        property="name",
                        operator=FilterOperator.like,
                        value="generate.",
                    ),
                    FilterClause(
                        property="metadata.selectedMeterSlug",
                        operator=FilterOperator.eq,
                        value="v1:meter:pack",
                    ),
                ],
            ),
            aggregation=PropertyAggregation(
                func=AggregationFunction.sum,
                property="metadata.totalPrice",
            ),
        ),
        auth_subject=auth_subject,
    )
    typer.echo(f"Created meter: Usage (pack) - {meter_pack.id}", err=True)

    # Meter 2: Usage (tier)
    meter_tier = await meter_service.create(
        session=session,
        meter_create=MeterCreate(
            name=f"Usage (tier) - {run_id}",
            organization_id=organization.id,
            filter=Filter(
                conjunction=FilterConjunction.and_,
                clauses=[
                    FilterClause(
                        property="name",
                        operator=FilterOperator.like,
                        value="generate.",
                    ),
                    FilterClause(
                        property="metadata.selectedMeterSlug",
                        operator=FilterOperator.eq,
                        value="v1:meter:tier",
                    ),
                ],
            ),
            aggregation=PropertyAggregation(
                func=AggregationFunction.sum,
                property="metadata.totalPrice",
            ),
        ),
        auth_subject=auth_subject,
    )
    typer.echo(f"Created meter: Usage (tier) - {meter_tier.id}", err=True)

    await session.commit()

    # Get existing API token from environment if set
    existing_token = os.getenv("LOAD_TEST_API_TOKEN")
    api_token_line = (
        f"LOAD_TEST_API_TOKEN={existing_token}"
        if existing_token
        else "LOAD_TEST_API_TOKEN=polar_pat_REPLACE_WITH_YOUR_TOKEN"
    )

    # Output .env format
    env_output = f"""# Event Ingestion Load Test Configuration
# Generated by loadtest_setup.py
# Organization: {organization.name} ({organization_slug})

# Required: API host and authentication
# Note: Use an organization access token (polar_oat_*) for this organization
LOAD_TEST_HOST=http://127.0.0.1:8000
{api_token_line}

# Event ingestion test data (external customer IDs)
LOAD_TEST_EVENT_EXTERNAL_CUSTOMER_IDS={",".join(external_customer_ids)}

# Optional: Batch size (default: 10)
# LOAD_TEST_EVENT_BATCH_SIZE=10
"""

    if output_file:
        with open(output_file, "w") as f:
            f.write(env_output)
        typer.echo(f"\nConfiguration written to {output_file}", err=True)
    else:
        typer.echo(env_output)

    typer.echo(f"\n✅ Created {num_customers} customers and 2 meters", err=True)
    if not existing_token:
        typer.echo(
            "⚠️  Remember to replace LOAD_TEST_API_TOKEN with your actual token!",
            err=True,
        )


@cli.command()
def setup(
    organization_slug: str = typer.Option(
        ..., "--organization-slug", "-o", help="Organization slug"
    ),
    num_customers: int = typer.Option(
        20, "--num-customers", "-n", help="Number of customers to create"
    ),
    output: str | None = typer.Option(
        None, "--output", "-f", help="Output file path (default: stdout)"
    ),
) -> None:
    """Setup load test data for event ingestion."""

    async def run() -> None:
        redis = create_redis("app")
        async with JobQueueManager.open(dramatiq.get_broker(), redis):
            engine = create_async_engine("script")
            sessionmaker = create_async_sessionmaker(engine)
            async with sessionmaker() as session:
                await create_loadtest_data(
                    session, organization_slug, num_customers, output
                )

    asyncio.run(run())


if __name__ == "__main__":
    cli()
