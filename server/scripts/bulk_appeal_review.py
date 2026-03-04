"""
Bulk Appeal Review — find unanswered appeal threads in Plain, run AI review,
send draft emails, and persist APPROVE/DENY decisions to the DB.

Usage:
    cd server

    # Dry-run mode, process 1 thread (default — safe, no changes):
    uv run python -m scripts.bulk_appeal_review

    # Process 5 threads in dry-run mode:
    uv run python -m scripts.bulk_appeal_review --limit 5

    # Process all threads in dry-run mode:
    uv run python -m scripts.bulk_appeal_review --limit 0

    # Actually send replies and persist decisions for 1 thread:
    uv run python -m scripts.bulk_appeal_review --execute

    # Process all threads:
    uv run python -m scripts.bulk_appeal_review --execute --limit 0
"""

from __future__ import annotations

import argparse
import asyncio
import re
import sys
from collections import Counter
from typing import Any

import httpx
import structlog
from plain_client import (
    Plain,
    ReplyToThreadInput,
    SnoozeStatusDetail,
    SnoozeThreadInput,
    ThreadsFilter,
    ThreadStatus,
)

from polar.config import settings
from polar.kit.db.postgres import create_async_sessionmaker
from polar.organization.repository import OrganizationRepository
from polar.organization.service import organization as organization_service
from polar.postgres import create_async_engine

from .appeal_review import AppealAction, run_appeal_review_with_deps

log = structlog.get_logger(__name__)

APPEAL_LABEL_TYPE_ID = "lt_01K3QWYTDV7RSS7MM2RC584X41"
SLUG_PATTERN = re.compile(r"Organization Appeal - (\S+)")

TIMELINE_QUERY = """
query ThreadTimeline($threadId: ID!) {
  thread(threadId: $threadId) {
    timelineEntries(first: 50) {
      edges {
        node {
          actor {
            __typename
          }
          entry {
            __typename
          }
        }
      }
    }
  }
}
"""


async def get_appeal_threads(plain: Plain) -> list[dict[str, str]]:
    """Paginate all Plain threads with the appeal label."""
    threads: list[dict[str, str]] = []
    cursor: str | None = None

    while True:
        kwargs: dict[str, Any] = dict(
            filters=ThreadsFilter(
                label_type_ids=[APPEAL_LABEL_TYPE_ID],
                statuses=[ThreadStatus.TODO, ThreadStatus.SNOOZED],
            ),
            first=50,
        )
        if cursor is not None:
            kwargs["after"] = cursor

        result = await plain.threads(**kwargs)

        for edge in result.edges:
            thread = edge.node
            match = SLUG_PATTERN.search(thread.title or "")
            if not match:
                log.debug(
                    "Skipping thread (title does not match appeal pattern)",
                    thread_id=thread.id,
                    title=thread.title,
                )
                continue
            if thread.id:
                threads.append({"thread_id": thread.id, "slug": match.group(1)})

        if not result.page_info.has_next_page:
            break
        cursor = result.page_info.end_cursor

    return threads


async def is_thread_answered(plain_token: str, thread_id: str) -> bool:
    """Check if a thread already has a staff reply (userActor) or outbound email."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://core-api.uk.plain.com/graphql/v1",
            headers={
                "Authorization": f"Bearer {plain_token}",
                "Content-Type": "application/json",
            },
            json={"query": TIMELINE_QUERY, "variables": {"threadId": thread_id}},
            timeout=15.0,
        )

    if response.status_code != 200:
        log.warning(
            "Failed to fetch timeline", thread_id=thread_id, status=response.status_code
        )
        return True  # Treat errors as "answered" to skip safely

    data = response.json()
    thread_data = data.get("data", {}).get("thread")
    if not thread_data:
        return True

    entries = thread_data.get("timelineEntries", {}).get("edges", [])
    for edge in entries:
        node = edge.get("node", {})
        actor = node.get("actor", {})
        entry = node.get("entry", {})
        # Staff replied via chat or email
        if actor.get("__typename") == "UserActor" and entry.get("__typename") in (
            "ChatEntry",
            "EmailEntry",
        ):
            return True

    return False


async def process_appeals(
    dry_run: bool = True,
    limit: int = 1,
    model: str = "gpt-5.2-2025-12-11",
    skip_website: bool = False,
) -> None:
    engine = create_async_engine("script")
    session_maker = create_async_sessionmaker(engine)
    plain_token = settings.PLAIN_TOKEN
    if not plain_token:
        raise RuntimeError("PLAIN_TOKEN is not configured")

    async with httpx.AsyncClient(
        headers={"Authorization": f"Bearer {plain_token}"},
    ) as http_client:
        async with Plain(
            "https://core-api.uk.plain.com/graphql/v1", http_client=http_client
        ) as plain:
            # 1. Fetch appeal threads
            log.info("Fetching appeal threads from Plain...")
            all_threads = await get_appeal_threads(plain)
            log.info("Found appeal threads", count=len(all_threads))

            # 2. Filter to unanswered
            unanswered: list[dict[str, str]] = []
            for thread_data in all_threads:
                answered = await is_thread_answered(
                    plain_token, thread_data["thread_id"]
                )
                if not answered:
                    unanswered.append(thread_data)
                else:
                    log.debug(
                        "Skipping answered thread",
                        thread_id=thread_data["thread_id"],
                        slug=thread_data["slug"],
                    )

            log.info("Unanswered appeal threads", count=len(unanswered))

            # 3. Apply limit
            to_process = unanswered[:limit] if limit > 0 else unanswered
            if len(unanswered) > len(to_process):
                log.info(
                    "Limiting threads",
                    total=len(unanswered),
                    processing=len(to_process),
                )

            # 4. Process each thread
            counts: Counter[str] = Counter()
            errors = 0

            for thread_data in to_process:
                thread_id = thread_data["thread_id"]
                slug = thread_data["slug"]

                try:
                    log.info("Running appeal review", slug=slug, thread_id=thread_id)
                    result = await run_appeal_review_with_deps(
                        slug,
                        session_maker=session_maker,
                        plain_client=plain,
                        plain_token=plain_token,
                        model=model,
                        skip_website=skip_website,
                    )
                    counts[result.action] += 1

                    if dry_run:
                        log.info(
                            "DRY RUN: Would send reply and persist decision",
                            slug=slug,
                            action=result.action,
                            draft_email_preview=result.draft_email[:200],
                        )
                        continue

                    # Send reply to thread
                    reply_result = await plain.reply_to_thread(
                        ReplyToThreadInput(
                            thread_id=thread_id,
                            text_content=result.draft_email,
                            markdown_content=result.draft_email,
                        )
                    )
                    if reply_result.error is not None:
                        log.error(
                            "Failed to reply",
                            thread_id=thread_id,
                            slug=slug,
                            error=str(reply_result.error),
                        )
                    else:
                        log.info("Sent reply", thread_id=thread_id, slug=slug)

                    # Persist DB decision
                    async with session_maker() as session:
                        org_repo = OrganizationRepository.from_session(session)
                        org = await org_repo.get_by_slug(slug)
                        if org is None:
                            log.error("Organization not found for DB update", slug=slug)
                        else:
                            if result.action == AppealAction.APPROVE:
                                await organization_service.approve_appeal(session, org)
                                log.info("Approved appeal in DB", slug=slug)
                            elif result.action == AppealAction.DENY:
                                await organization_service.deny_appeal(session, org)
                                log.info("Denied appeal in DB", slug=slug)
                            else:
                                log.info("Follow-up — no DB change", slug=slug)
                            await session.commit()

                    # Snooze thread
                    snooze_result = await plain.snooze_thread(
                        SnoozeThreadInput(
                            thread_id=thread_id,
                            status_detail=SnoozeStatusDetail.WAITING_FOR_CUSTOMER,
                        )
                    )
                    if snooze_result.error is not None:
                        log.error(
                            "Failed to snooze",
                            thread_id=thread_id,
                            error=str(snooze_result.error),
                        )
                    else:
                        log.info("Snoozed thread", thread_id=thread_id)

                except Exception:
                    errors += 1
                    log.error(
                        "Failed to process thread",
                        slug=slug,
                        thread_id=thread_id,
                        exc_info=True,
                    )

            # 5. Summary
            log.info(
                "Summary",
                total_appeal_threads=len(all_threads),
                unanswered=len(unanswered),
                processed=len(to_process),
                approve=counts.get(AppealAction.APPROVE, 0),
                deny=counts.get(AppealAction.DENY, 0),
                follow_up=counts.get(AppealAction.FOLLOW_UP, 0),
                errors=errors,
                dry_run=dry_run,
            )

    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Bulk appeal review — find unanswered appeals, run AI review, send replies (defaults to dry-run)"
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually send replies and persist decisions (by default, runs in dry-run mode)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=1,
        help="Maximum number of threads to process (default: 1, use 0 for unlimited)",
    )
    parser.add_argument(
        "--model",
        default="gpt-5.2-2025-12-11",
        help="AI model to use for review (default: gpt-5.2-2025-12-11)",
    )
    parser.add_argument(
        "--skip-website",
        action="store_true",
        help="Skip website browsing during review",
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
        log.info("Use --execute to actually send replies and persist decisions")
    else:
        log.warning(
            "Running in EXECUTE mode — replies will be sent and decisions persisted!"
        )

    log.info(
        "Processing settings",
        limit=args.limit if args.limit > 0 else "unlimited",
        model=args.model,
        skip_website=args.skip_website,
        dry_run=dry_run,
    )

    try:
        asyncio.run(
            process_appeals(
                dry_run=dry_run,
                limit=args.limit,
                model=args.model,
                skip_website=args.skip_website,
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
