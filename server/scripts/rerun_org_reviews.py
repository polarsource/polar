"""
Script to re-run AI reviews on stuck organizations and auto-approve passing ones.

Targets organizations under review that either:
- Have no agent review at all (pre-agent era)
- Have a stale/buggy review (e.g. setup_complete context that took no action)

For each organization:
1. Runs the AI review agent
2. Saves the agent report
3. If verdict is APPROVE: auto-approves the organization
4. If verdict is DENY/NEEDS_HUMAN_REVIEW: creates a Plain ticket for human review

Usage:
    cd server

    # Dry-run mode, process 1 org (default - lists what would happen):
    uv run python -m scripts.rerun_org_reviews

    # Process 5 orgs in dry-run:
    uv run python -m scripts.rerun_org_reviews --limit 5

    # Process all in dry-run:
    uv run python -m scripts.rerun_org_reviews --limit 0

    # Actually execute for all:
    uv run python -m scripts.rerun_org_reviews --execute --limit 0

    # Target a specific org:
    uv run python -m scripts.rerun_org_reviews --execute --org-id a06e2689-0263-47f9-b9ce-36561878bc97

    # Skip orgs that already have a recent agent review (only review unreviewed orgs):
    uv run python -m scripts.rerun_org_reviews --execute --limit 0 --only-unreviewed
"""

import argparse
import asyncio
import sys
import uuid as uuid_mod
from datetime import UTC, datetime

import dramatiq
import structlog
from sqlalchemy import select
from sqlalchemy.orm import joinedload

import polar.tasks  # noqa: F401 — registers actors with dramatiq
from polar.integrations.plain.service import plain as plain_service
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Organization
from polar.models.organization import OrganizationStatus
from polar.organization.repository import OrganizationRepository
from polar.organization.service import organization as organization_service
from polar.organization_review.agent import run_organization_review
from polar.organization_review.report import build_agent_report
from polar.organization_review.repository import OrganizationReviewRepository
from polar.organization_review.schemas import ReviewContext, ReviewVerdict
from polar.postgres import create_async_engine
from polar.redis import create_redis
from polar.worker import JobQueueManager

log = structlog.get_logger()


async def process_organizations(
    dry_run: bool = True,
    limit: int = 1,
    org_id: uuid_mod.UUID | None = None,
    only_unreviewed: bool = False,
) -> None:
    engine = create_async_engine("script")
    AsyncSessionMaker = create_async_sessionmaker(engine)
    redis = create_redis("script")

    stats = {
        "total": 0,
        "reviewed": 0,
        "approved": 0,
        "escalated": 0,
        "errors": 0,
        "skipped": 0,
    }

    async with AsyncSessionMaker() as session:
        repository = OrganizationRepository.from_session(session)

        # Query organizations under review
        statement = (
            select(Organization)
            .where(Organization.status == OrganizationStatus.REVIEW)
            .options(joinedload(Organization.account))
            .order_by(Organization.status_updated_at.desc())
        )

        if org_id is not None:
            statement = statement.where(Organization.id == org_id)

        if only_unreviewed:
            from polar.models.organization_agent_review import (
                OrganizationAgentReview,
            )

            reviewed_org_ids = select(
                OrganizationAgentReview.organization_id
            ).distinct()
            statement = statement.where(Organization.id.notin_(reviewed_org_ids))

        result = await session.execute(statement)
        organizations = result.unique().scalars().all()

        stats["total"] = len(organizations)
        organizations_to_process = organizations[:limit] if limit > 0 else organizations

        log.info(
            "Found organizations under review",
            total=len(organizations),
            processing=len(organizations_to_process),
            only_unreviewed=only_unreviewed,
        )

        for i, organization in enumerate(organizations_to_process):
            org_log = log.bind(
                progress=f"{i + 1}/{len(organizations_to_process)}",
                organization_id=str(organization.id),
                slug=organization.slug,
                status=organization.status,
            )

            if dry_run:
                org_log.info(
                    "DRY RUN: Would review",
                    status_updated_at=str(organization.status_updated_at),
                    initially_reviewed=organization.initially_reviewed_at is not None,
                )
                continue

            # Run the AI review
            try:
                org_log.info("Running AI review...")
                review_result = await run_organization_review(
                    session, organization, context=ReviewContext.THRESHOLD
                )
            except Exception:
                org_log.exception("AI review failed")
                stats["errors"] += 1
                continue

            report = review_result.report
            org_log.info(
                "Review complete",
                verdict=report.verdict.value,
                risk_score=report.overall_risk_score,
                summary=report.summary[:120],
            )

            # Save agent report
            review_repository = OrganizationReviewRepository.from_session(session)
            typed_report = build_agent_report(review_result, review_type="threshold")
            await review_repository.save_agent_review(
                organization_id=organization.id,
                report=typed_report,
                reviewed_at=datetime.now(UTC),
            )
            stats["reviewed"] += 1

            # Act on verdict
            if report.verdict == ReviewVerdict.APPROVE:
                # confirm_organization_reviewed calls enqueue_job, so we need
                # the JobQueueManager context to flush jobs to the broker.
                async with JobQueueManager.open(dramatiq.get_broker(), redis):
                    await organization_service.confirm_organization_reviewed(
                        session, organization
                    )

                stats["approved"] += 1
                org_log.info(
                    "Auto-approved",
                    next_threshold=organization.next_review_threshold,
                )
            else:
                # DENY or NEEDS_HUMAN_REVIEW → create Plain ticket
                try:
                    await plain_service.create_organization_review_thread(
                        session, organization
                    )
                    org_log.info("Created Plain ticket for human review")
                except Exception:
                    org_log.exception("Failed to create Plain ticket")

                stats["escalated"] += 1

            # Commit after each org so we don't lose progress on failure
            await session.commit()

    log.info("Done", **stats)
    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Re-run AI reviews on stuck organizations (defaults to dry-run)"
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually run reviews and take action (default: dry-run)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=1,
        help="Max organizations to process (default: 1, use 0 for unlimited)",
    )
    parser.add_argument(
        "--org-id",
        type=uuid_mod.UUID,
        default=None,
        help="Process only this specific organization ID",
    )
    parser.add_argument(
        "--only-unreviewed",
        action="store_true",
        help="Only process orgs that have never had an agent review",
    )
    args = parser.parse_args()

    dry_run = not args.execute

    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer(),
        ]
    )

    if dry_run:
        log.info("Running in DRY-RUN mode (no reviews will be run)")
        log.info("Use --execute to actually run reviews")
    else:
        log.warning(
            "Running in EXECUTE mode - reviews will run and orgs may be approved!"
        )

    log.info(
        "Settings",
        limit=args.limit if args.limit > 0 else "unlimited",
        dry_run=dry_run,
        org_id=str(args.org_id) if args.org_id else None,
        only_unreviewed=args.only_unreviewed,
    )

    try:
        asyncio.run(
            process_organizations(
                dry_run=dry_run,
                limit=args.limit,
                org_id=args.org_id,
                only_unreviewed=args.only_unreviewed,
            )
        )
    except KeyboardInterrupt:
        log.info("Interrupted by user")
        sys.exit(1)
    except Exception as e:
        log.error("Script failed", error=str(e), exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
