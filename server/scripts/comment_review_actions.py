"""
Script to post review messages on Plain "Initial Account Review" threads.

Mirrors the logic in PlainService.create_organization_review_thread so that
existing threads that were created before we started sending the outbound
review email can be backfilled with the same message, assignment, and snooze.

For each "Initial Account Review" thread in Plain:
1. Extract the org slug from the thread preview text
2. Check the org for issues (missing website, missing socials, unverified admin)
3. Post the review message, assign to a support agent, and snooze if action items exist

Usage:
    cd server

    # Dry-run mode, process 1 thread (default - safe, no changes):
    uv run python -m scripts.comment_review_actions

    # Process 5 threads in dry-run mode:
    uv run python -m scripts.comment_review_actions --limit 5

    # Process all threads in dry-run mode:
    uv run python -m scripts.comment_review_actions --limit 0

    # Actually post comments for 1 thread:
    uv run python -m scripts.comment_review_actions --execute

    # Actually post comments for all threads:
    uv run python -m scripts.comment_review_actions --execute --limit 0
"""

import argparse
import asyncio
import dataclasses
import random
import re
import sys
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import structlog
from plain_client import (
    AssignThreadInput,
    Plain,
    ReplyToThreadInput,
    SnoozeStatusDetail,
    SnoozeThreadInput,
    ThreadsFilter,
    ThreadStatus,
)
from plain_client.input_types import DatetimeFilter
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.config import settings
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Organization, User
from polar.postgres import AsyncSession, create_async_engine

log = structlog.get_logger()

REVIEW_LABEL_TYPE_ID = "lt_01JFG7F4N67FN3MAWK06FJ8FPG"
SLUG_PATTERN = re.compile(r"The organization `?(\S+?)`? should be reviewed")

SUPPORT_AGENT_IDS: list[str] = [
    "u_01K8JEAC8BS0ED0KBCGHYCHA70",  # Isac
    "u_01K0RC6SY9Q8KSVNAYGD7EY6M5",  # Rishi
]


@dataclasses.dataclass
class OrgIssues:
    missing_website: bool = False
    missing_socials: bool = False
    admin_not_verified: bool = False
    admin_verification_status: str = ""


async def get_review_threads(
    plain: Plain,
    older_than_days: int | None = None,
) -> list[dict[str, str]]:
    """Paginate all Plain threads with the review label, filtering to Initial Account Review."""
    threads: list[dict[str, str]] = []
    cursor: str | None = None

    created_at_filter: DatetimeFilter | None = None
    if older_than_days is not None:
        cutoff = datetime.now(UTC) - timedelta(days=older_than_days)
        cutoff_str = (
            cutoff.strftime("%Y-%m-%dT%H:%M:%S.") + f"{cutoff.microsecond // 1000:03d}Z"
        )
        created_at_filter = DatetimeFilter(before=cutoff_str)
        log.info(
            "Filtering threads older than",
            days=older_than_days,
            before=cutoff_str,
        )

    while True:
        kwargs: dict[str, Any] = dict(
            filters=ThreadsFilter(
                label_type_ids=[REVIEW_LABEL_TYPE_ID],
                statuses=[ThreadStatus.TODO, ThreadStatus.SNOOZED],
                created_at=created_at_filter,
            ),
            first=50,
        )
        if cursor is not None:
            kwargs["after"] = cursor

        result = await plain.threads(**kwargs)

        for edge in result.edges:
            thread = edge.node
            if thread.title != "Initial Account Review":
                continue
            preview = thread.preview_text or ""
            match = SLUG_PATTERN.search(preview)
            if not match:
                log.info(
                    "Skipping thread (preview does not contain org slug — likely already replied to)",
                    thread_id=thread.id,
                )
                continue
            threads.append({"thread_id": thread.id, "slug": match.group(1)})

        if not result.page_info.has_next_page:
            break
        cursor = result.page_info.end_cursor

    return threads


async def check_org_issues(
    session: AsyncSession, slug: str
) -> tuple[OrgIssues, str] | None:
    """Check an organization for actionable issues.

    Returns a tuple of (issues, org_name) or None if org not found.
    """
    issues = OrgIssues()

    # Load organization with account
    stmt = (
        select(Organization)
        .where(Organization.slug == slug, Organization.deleted_at.is_(None))
        .options(joinedload(Organization.account))
    )
    result = await session.execute(stmt)
    org = result.unique().scalar_one_or_none()
    if org is None:
        log.warning("Organization not found", slug=slug)
        return None

    org_name = org.name or org.slug

    if not org.website:
        issues.missing_website = True

    if not org.socials:
        issues.missing_socials = True

    # Check admin identity verification
    if org.account is not None:
        admin_stmt = select(User).where(User.id == org.account.admin_id)
        admin_result = await session.execute(admin_stmt)
        admin = admin_result.unique().scalar_one_or_none()
        if admin is not None and not admin.identity_verified:
            issues.admin_not_verified = True
            issues.admin_verification_status = admin.identity_verification_status

    return issues, org_name


def has_action_items(issues: OrgIssues) -> bool:
    return issues.missing_website or issues.missing_socials or issues.admin_not_verified


def build_review_message(organization_name: str, issues: OrgIssues) -> str:
    """Build a friendly numbered message adapted to the org's specific issues.

    Matches PlainService._build_review_message exactly.
    """
    lines: list[str] = [
        f"Welcome to Polar! Your organization {organization_name} is currently being reviewed. "
        "This is a standard step all new organizations go through so we can verify account details and ensure compliance with our policies.",
        "",
        "Reviews typically take up to 3 business days (occasionally up to 7). "
        "You can keep using Polar in the mean time to set up your products and integration.",
        "",
    ]

    has_items = has_action_items(issues)

    if has_items:
        item_num = 1

        if issues.missing_website:
            lines.append(
                f"{item_num}. Please add your product's URL under Settings \u2192 General \u2192 Website."
            )
            item_num += 1

        if issues.missing_socials:
            lines.append(
                f"{item_num}. Please add your personal social links (not your product's) under Settings \u2192 General \u2192 Social links. "
                "These are never displayed publicly. We only use them to verify your identity to avoid people impersonating businesses they do not own."
            )
            item_num += 1

        if issues.admin_not_verified:
            lines.append(
                f"{item_num}. Verify your identity under Finance \u2192 Payout account. "
                "You'll need an ID document (driver's license, ID, passport, ...) and your phone. "
                "It's fully secure and only takes a few minutes."
            )

        lines.append("")

    if has_items:
        lines.append(
            "Once you've completed these steps, please reply to this email and we'll finalize your review."
        )
    else:
        lines.append(
            "We'll let you know as soon as you're all set, or if we need anything from you."
        )
    lines.append("")
    lines.append(
        "You can learn more about our review process on our website: "
        "https://polar.sh/docs/merchant-of-record/account-reviews. "
        "Any other questions? Just reply to this message."
    )
    lines.append("")
    lines.append("Cheers,")
    lines.append("")
    lines.append("The customer success team at Polar")

    return "\n".join(lines)


async def process_threads(
    dry_run: bool = True, limit: int = 1, older_than_days: int | None = None
) -> None:
    engine = create_async_engine("script")
    AsyncSessionMaker = create_async_sessionmaker(engine)

    async with httpx.AsyncClient(
        headers={"Authorization": f"Bearer {settings.PLAIN_TOKEN}"},
    ) as http_client:
        async with Plain(
            "https://core-api.uk.plain.com/graphql/v1", http_client=http_client
        ) as plain:
            log.info("Fetching Initial Account Review threads from Plain...")
            threads = await get_review_threads(plain, older_than_days=older_than_days)
            log.info("Found threads", count=len(threads))

            threads_limited = threads[:limit] if limit > 0 else threads
            if len(threads) > len(threads_limited):
                log.info(
                    "Limiting threads to process",
                    total=len(threads),
                    processing=len(threads_limited),
                )

            processed = 0
            async with AsyncSessionMaker() as session:
                for thread_data in threads_limited:
                    thread_id = thread_data["thread_id"]
                    slug = thread_data["slug"]

                    check_result = await check_org_issues(session, slug)

                    if check_result is None:
                        continue

                    issues, org_name = check_result
                    message = build_review_message(org_name, issues)
                    has_items = has_action_items(issues)

                    log.info(
                        "Processing thread",
                        slug=slug,
                        thread_id=thread_id,
                        org_name=org_name,
                        missing_website=issues.missing_website,
                        missing_socials=issues.missing_socials,
                        admin_not_verified=issues.admin_not_verified,
                        has_action_items=has_items,
                        message=message,
                    )

                    if dry_run:
                        log.info(
                            "DRY RUN: Would post message, assign, and snooze",
                            thread_id=thread_id,
                            slug=slug,
                            would_snooze=has_items,
                        )
                    else:
                        # 1. Assign thread to a random support agent
                        agent_id = random.choice(SUPPORT_AGENT_IDS)
                        assign_result = await plain.assign_thread(
                            AssignThreadInput(
                                thread_id=thread_id,
                                user_id=agent_id,
                            )
                        )
                        if assign_result.error is not None:
                            log.error(
                                "Failed to assign thread",
                                thread_id=thread_id,
                                slug=slug,
                                error=str(assign_result.error),
                            )

                        # 2. Post the review message as an outbound reply
                        reply_result = await plain.reply_to_thread(
                            ReplyToThreadInput(
                                thread_id=thread_id,
                                text_content=message,
                                markdown_content=message,
                            )
                        )
                        if reply_result.error is not None:
                            log.error(
                                "Failed to post message",
                                thread_id=thread_id,
                                slug=slug,
                                error=str(reply_result.error),
                            )
                        else:
                            log.info(
                                "Posted review message",
                                thread_id=thread_id,
                                slug=slug,
                            )

                        # 3. Snooze the thread if we asked the customer for more details
                        if has_items:
                            snooze_result = await plain.snooze_thread(
                                SnoozeThreadInput(
                                    thread_id=thread_id,
                                    status_detail=SnoozeStatusDetail.WAITING_FOR_CUSTOMER,
                                )
                            )
                            if snooze_result.error is not None:
                                log.error(
                                    "Failed to snooze thread",
                                    thread_id=thread_id,
                                    slug=slug,
                                    error=str(snooze_result.error),
                                )
                            else:
                                log.info(
                                    "Snoozed thread",
                                    thread_id=thread_id,
                                    slug=slug,
                                )

                    processed += 1

            log.info(
                "Summary",
                threads_found=len(threads),
                threads_processed=len(threads_limited),
                actioned=processed,
                dry_run=dry_run,
            )

    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Post review messages on Plain review threads (defaults to dry-run)"
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually post messages (by default, runs in dry-run mode)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=1,
        help="Maximum number of threads to process (default: 1, use 0 for unlimited)",
    )
    parser.add_argument(
        "--older-than-days",
        type=int,
        default=None,
        help="Only process threads created more than N days ago",
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
        log.info("Running in DRY-RUN mode (no changes will be made)")
        log.info("Use --execute to actually post messages")
    else:
        log.warning("Running in EXECUTE mode - messages will be posted!")

    log.info(
        "Processing settings",
        limit=args.limit if args.limit > 0 else "unlimited",
        older_than_days=args.older_than_days or "any",
        dry_run=dry_run,
    )

    try:
        asyncio.run(
            process_threads(
                dry_run=dry_run,
                limit=args.limit,
                older_than_days=args.older_than_days,
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
