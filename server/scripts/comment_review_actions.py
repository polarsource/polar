"""
Script to post action-required comments on Plain review threads.

For each "Initial Account Review" thread in Plain:
1. Extract the org slug from the thread preview text
2. Check the org for issues (missing website, missing socials, unverified admin, test orders)
3. Post a checklist comment on the thread listing required actions

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
import re
import sys
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import structlog
from plain_client import Plain, ReplyToThreadInput, ThreadsFilter, ThreadStatus
from plain_client.input_types import DatetimeFilter
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from polar.config import settings
from polar.kit.currency import format_currency
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Customer, Order, Organization, User, UserOrganization
from polar.models.order import OrderStatus
from polar.postgres import AsyncSession, create_async_engine

GUIDELINES_URL = (
    "https://polar.sh/docs/merchant-of-record/account-reviews#operational-guidelines"
)

log = structlog.get_logger()

REVIEW_LABEL_TYPE_ID = "lt_01JFG7F4N67FN3MAWK06FJ8FPG"
SLUG_PATTERN = re.compile(r"The organization `?(\S+?)`? should be reviewed")


@dataclasses.dataclass
class OrgIssues:
    missing_website: bool = False
    missing_socials: bool = False
    admin_not_verified: bool = False
    admin_verification_status: str = ""
    test_order_count: int = 0
    test_order_total: str = ""


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


async def check_org_issues(session: AsyncSession, slug: str) -> OrgIssues | None:
    """Check an organization for actionable issues. Returns None if org not found."""
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

    # Check missing website
    if not org.website:
        issues.missing_website = True

    # Check missing socials
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

    # Check for non-refunded test orders (customer email matches an org member email)
    member_emails_stmt = (
        select(func.lower(User.email))
        .join(UserOrganization, UserOrganization.user_id == User.id)
        .where(UserOrganization.organization_id == org.id)
    )
    member_emails_result = await session.execute(member_emails_stmt)
    member_emails = set(member_emails_result.scalars().all())

    if member_emails:
        test_orders_stmt = (
            select(Order)
            .join(Customer, Customer.id == Order.customer_id)
            .where(
                Customer.organization_id == org.id,
                func.lower(Customer.email).in_(member_emails),
                Order.status == OrderStatus.paid,
                Order.net_amount > 0,
            )
        )
        test_orders_result = await session.execute(test_orders_stmt)
        test_orders = test_orders_result.scalars().all()

        if test_orders:
            total = sum(o.net_amount for o in test_orders)
            currency = test_orders[0].currency
            issues.test_order_count = len(test_orders)
            issues.test_order_total = format_currency(total, currency)

    return issues


def has_issues(issues: OrgIssues) -> bool:
    return (
        issues.missing_website
        or issues.missing_socials
        or issues.admin_not_verified
        or issues.test_order_count > 0
    )


def build_comment(slug: str, issues: OrgIssues) -> str:
    """Build a friendly numbered message adapted to the org's specific issues."""
    lines: list[str] = [
        "Thank you so much for submitting the form about you, your business & intended use case with Polar.",
        "However, we have some follow-up questions/requirements for our review:",
        "",
    ]

    item_num = 1

    if issues.missing_website:
        lines.append(
            f"{item_num}. Can you please add your product's URL to the org settings in Polar dashboard? "
            "You can add or change this by navigating to Settings > General and changing the field named 'Website'."
        )
        item_num += 1

    if issues.missing_socials:
        lines.append(
            f"{item_num}. Can you please add your personal social links (not the product's) to the org settings in Polar dashboard? "
            "We associate with the merchant to make sure we know who's behind what. "
            "In the past, people have used stolen emails to act on behalf of stores that don't even know what's happening in their name."
        )
        item_num += 1

    # Always ask for a discount code to test the payment flow
    lines.append(
        f"{item_num}. Can you share a 100% discount code that I can test the payment flow with?"
    )
    item_num += 1

    if issues.test_order_count > 0:
        lines.append(
            f"{item_num}. Could you please refund all the test sales "
            "(by going to Sales > Orders > [Particular Order] > Scroll and click Refund order) "
            f"as per our guidelines - {GUIDELINES_URL}?"
        )
        item_num += 1

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

            comments_to_post = 0
            async with AsyncSessionMaker() as session:
                for thread_data in threads_limited:
                    thread_id = thread_data["thread_id"]
                    slug = thread_data["slug"]

                    issues = await check_org_issues(session, slug)

                    if issues is None:
                        continue

                    if not has_issues(issues):
                        log.info("No issues found, skipping", slug=slug)
                        continue

                    comment = build_comment(slug, issues)

                    log.info(
                        "Issues found",
                        slug=slug,
                        thread_id=thread_id,
                        missing_website=issues.missing_website,
                        missing_socials=issues.missing_socials,
                        admin_not_verified=issues.admin_not_verified,
                        test_orders=issues.test_order_count,
                        comment=comment,
                    )

                    if dry_run:
                        log.info(
                            "DRY RUN: Would post comment",
                            thread_id=thread_id,
                            slug=slug,
                        )
                    else:
                        result = await plain.reply_to_thread(
                            ReplyToThreadInput(
                                thread_id=thread_id,
                                text_content=comment,
                                markdown_content=comment,
                            )
                        )
                        if result.error is not None:
                            log.error(
                                "Failed to post comment",
                                thread_id=thread_id,
                                slug=slug,
                                error=str(result.error),
                            )
                        else:
                            log.info(
                                "Posted comment",
                                thread_id=thread_id,
                                slug=slug,
                            )

                    comments_to_post += 1

            log.info(
                "Summary",
                threads_found=len(threads),
                threads_processed=len(threads_limited),
                comments=comments_to_post,
                dry_run=dry_run,
            )

    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Post action-required comments on Plain review threads (defaults to dry-run)"
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually post comments (by default, runs in dry-run mode)",
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
        log.info("Running in DRY-RUN mode (no comments will be posted)")
        log.info("Use --execute to actually post comments")
    else:
        log.warning("Running in EXECUTE mode - comments will be posted!")

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
