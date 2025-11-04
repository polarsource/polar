"""
Script to create Plain tickets for organizations under review.

For each organization with status UNDER_REVIEW:
1. Compute the same check as organization.service.check_review_threshold
2. If threshold is positive, check if a Plain ticket exists with title "Account Review"
3. If no ticket exists (or all are closed), create a new one

Usage:
    cd server

    # Dry-run mode, process 1 organization (default - safe, no changes):
    uv run python -m scripts.create_review_tickets

    # Process 5 organizations in dry-run mode:
    uv run python -m scripts.create_review_tickets --limit 5

    # Process all organizations in dry-run mode:
    uv run python -m scripts.create_review_tickets --limit 0

    # Actually create tickets for 1 organization:
    uv run python -m scripts.create_review_tickets --execute

    # Actually create tickets for all organizations:
    uv run python -m scripts.create_review_tickets --execute --limit 0
"""

import argparse
import asyncio
import sys
from typing import cast

import structlog
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.integrations.plain.service import plain as plain_service
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Organization
from polar.models.transaction import TransactionType
from polar.organization.repository import OrganizationRepository
from polar.postgres import create_async_engine
from polar.transaction.service.transaction import transaction as transaction_service
from polar.user.repository import UserRepository

log = structlog.get_logger()


async def process_organizations(dry_run: bool = False, limit: int = 1) -> None:
    """Process organizations under review and create tickets if needed.

    Args:
        dry_run: If True, don't actually create tickets
        limit: Maximum number of organizations to process (default: 1)
    """

    engine = create_async_engine("script")
    AsyncSessionMaker = create_async_sessionmaker(engine)

    organizations_to_process = []
    tickets_to_create = []

    async with AsyncSessionMaker() as session:
        repository = OrganizationRepository.from_session(session)

        # Query all organizations under review
        statement = (
            select(Organization)
            .where(Organization.is_under_review.is_(True))
            .options(joinedload(Organization.account))
        )

        result = await session.execute(statement)
        organizations = result.unique().scalars().all()

        log.info(
            "Found organizations under review",
            count=len(organizations),
            limit=limit,
        )

        # Limit the number of organizations to process
        organizations_limited = organizations[:limit] if limit > 0 else organizations

        if len(organizations) > len(organizations_limited):
            log.info(
                "Limiting organizations to process",
                total=len(organizations),
                processing=len(organizations_limited),
            )

        # For each organization, check if threshold is still positive
        for organization in organizations_limited:
            if not organization.account_id:
                log.warning(
                    "Organization has no account",
                    organization_id=str(organization.id),
                    organization_slug=organization.slug,
                )
                continue

            # Same computation as check_review_threshold
            transfers_sum = await transaction_service.get_transactions_sum(
                session, organization.account_id, type=TransactionType.balance
            )

            is_threshold_positive = (
                organization.next_review_threshold >= 0
                and transfers_sum > organization.next_review_threshold
            )

            if is_threshold_positive:
                organizations_to_process.append(
                    {
                        "organization": organization,
                        "transfers_sum": transfers_sum,
                        "threshold": organization.next_review_threshold,
                    }
                )
                log.info(
                    "Organization exceeds threshold",
                    organization_id=str(organization.id),
                    organization_slug=organization.slug,
                    transfers_sum=transfers_sum,
                    threshold=organization.next_review_threshold,
                )
            else:
                log.info(
                    "Organization below threshold, skipping",
                    organization_id=str(organization.id),
                    organization_slug=organization.slug,
                    transfers_sum=transfers_sum,
                    threshold=organization.next_review_threshold,
                )

        log.info(
            "Organizations that meet threshold criteria",
            count=len(organizations_to_process),
        )

        # Check if tickets exist for each organization
        user_repository = UserRepository.from_session(session)
        for org_data in organizations_to_process:
            organization = cast(Organization, org_data["organization"])

            if not organization.account:
                log.warning(
                    "Organization has no account loaded",
                    organization_id=str(organization.id),
                )
                continue

            # Get admin user
            admin = await user_repository.get_by_id(organization.account.admin_id)
            if not admin:
                log.warning(
                    "Organization account has no admin",
                    organization_id=str(organization.id),
                    account_id=str(organization.account_id),
                )
                continue

            # Check if thread exists
            # Note: Plain's GraphQL API for querying threads is complex and not well documented.
            # We attempt to check, but if it fails, we'll proceed with creating the ticket.
            # Plain may have its own duplicate detection.
            thread_exists = await plain_service.check_thread_exists(
                customer_email=admin.email,
                thread_title="Account Review",
            )

            if thread_exists:
                log.info(
                    "Thread already exists, skipping",
                    organization_id=str(organization.id),
                    organization_slug=organization.slug,
                    admin_email=admin.email,
                )
            else:
                log.info(
                    "Will create thread (or thread check failed)",
                    organization_id=str(organization.id),
                    organization_slug=organization.slug,
                    admin_email=admin.email,
                )
                tickets_to_create.append(
                    {
                        "organization": organization,
                        "admin": admin,
                    }
                )

        log.info(
            "Summary",
            organizations_under_review=len(organizations),
            organizations_meeting_threshold=len(organizations_to_process),
            tickets_to_create=len(tickets_to_create),
            dry_run=dry_run,
        )

        # Create tickets
        if tickets_to_create and not dry_run:
            log.info("Creating tickets", count=len(tickets_to_create))
            for ticket_data in tickets_to_create:
                organization = cast(Organization, ticket_data["organization"])
                try:
                    await plain_service.create_organization_review_thread(
                        session, organization
                    )
                    log.info(
                        "Created ticket",
                        organization_id=str(organization.id),
                        organization_slug=organization.slug,
                    )
                except Exception as e:
                    log.error(
                        "Failed to create ticket",
                        organization_id=str(organization.id),
                        organization_slug=organization.slug,
                        error=str(e),
                    )
        elif tickets_to_create and dry_run:
            log.info("DRY RUN: Would create tickets", count=len(tickets_to_create))
            for ticket_data in tickets_to_create:
                organization = cast(Organization, ticket_data["organization"])
                log.info(
                    "Would create ticket for",
                    organization_id=str(organization.id),
                    organization_slug=organization.slug,
                )

    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create Plain tickets for organizations under review (defaults to dry-run)"
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually create tickets (by default, runs in dry-run mode)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=1,
        help="Maximum number of organizations to process (default: 1, use 0 for unlimited)",
    )
    args = parser.parse_args()

    # Default to dry-run mode unless --execute is passed
    dry_run = not args.execute

    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer(),
        ]
    )

    if dry_run:
        log.info("Running in DRY-RUN mode (no tickets will be created)")
        log.info("Use --execute to actually create tickets")
    else:
        log.warning("Running in EXECUTE mode - tickets will be created!")

    log.info(
        "Processing settings",
        limit=args.limit if args.limit > 0 else "unlimited",
        dry_run=dry_run,
    )

    try:
        asyncio.run(process_organizations(dry_run=dry_run, limit=args.limit))
    except KeyboardInterrupt:
        log.info("Interrupted by user")
        sys.exit(1)
    except Exception as e:
        log.error("Script failed", error=str(e), exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
