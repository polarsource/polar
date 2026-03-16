"""
Script to assign unassigned Plain "Ongoing Account Review" threads to a support agent.

This is a one-off backfill script to ensure all open "Ongoing Account Review" threads
in Plain that are currently unassigned get assigned to a support agent.

For each "Ongoing Account Review" thread in Plain with status TODO or SNOOZED:
1. Skip if already assigned to someone
2. Assign to a randomly chosen support agent from SUPPORT_AGENT_IDS

Usage:
    cd server

    # Dry-run mode, process 1 thread (default - safe, no changes):
    uv run python -m scripts.assign_ongoing_review_threads

    # Process 5 threads in dry-run mode:
    uv run python -m scripts.assign_ongoing_review_threads --limit 5

    # Process all threads in dry-run mode:
    uv run python -m scripts.assign_ongoing_review_threads --limit 0

    # Actually assign threads for 1 thread:
    uv run python -m scripts.assign_ongoing_review_threads --execute

    # Actually assign all unassigned threads:
    uv run python -m scripts.assign_ongoing_review_threads --execute --limit 0
"""

import argparse
import asyncio
import random
import sys
from typing import Any

import httpx
import structlog
from plain_client import (
    AssignThreadInput,
    Plain,
    ThreadsFilter,
    ThreadStatus,
)

from polar.config import settings

log = structlog.get_logger()

REVIEW_LABEL_TYPE_ID = "lt_01JFG7F4N67FN3MAWK06FJ8FPG"

SUPPORT_AGENT_IDS: list[str] = [
    "u_01K8JEAC8BS0ED0KBCGHYCHA70",  # Isac
    "u_01K0RC6SY9Q8KSVNAYGD7EY6M5",  # Rishi
]


async def get_ongoing_review_threads(plain: Plain) -> list[str]:
    """Paginate all Plain threads with the review label, filtering to Ongoing Account Review."""
    thread_ids: list[str] = []
    cursor: str | None = None

    while True:
        kwargs: dict[str, Any] = dict(
            filters=ThreadsFilter(
                label_type_ids=[REVIEW_LABEL_TYPE_ID],
                statuses=[ThreadStatus.TODO, ThreadStatus.SNOOZED],
            ),
            first=50,
        )
        if cursor is not None:
            kwargs["after"] = cursor

        result = await plain.threads(**kwargs)

        for edge in result.edges:
            thread = edge.node
            if thread.title != "Ongoing Account Review":
                continue
            if thread.assigned_to is not None:
                log.info(
                    "Skipping thread (already assigned)",
                    thread_id=thread.id,
                    title=thread.title,
                )
                continue
            thread_ids.append(thread.id)

        if not result.page_info.has_next_page:
            break
        cursor = result.page_info.end_cursor

    return thread_ids


async def process_threads(dry_run: bool = True, limit: int = 1) -> None:
    async with httpx.AsyncClient(
        headers={"Authorization": f"Bearer {settings.PLAIN_TOKEN}"},
    ) as http_client:
        async with Plain(
            "https://core-api.uk.plain.com/graphql/v1", http_client=http_client
        ) as plain:
            log.info("Fetching unassigned Ongoing Account Review threads from Plain...")
            thread_ids = await get_ongoing_review_threads(plain)
            log.info("Found unassigned threads", count=len(thread_ids))

            threads_limited = thread_ids[:limit] if limit > 0 else thread_ids
            if len(thread_ids) > len(threads_limited):
                log.info(
                    "Limiting threads to process",
                    total=len(thread_ids),
                    processing=len(threads_limited),
                )

            actioned = 0
            for thread_id in threads_limited:
                agent_id = random.choice(SUPPORT_AGENT_IDS)

                log.info(
                    "Processing thread",
                    thread_id=thread_id,
                    would_assign_to=agent_id,
                )

                if dry_run:
                    log.info(
                        "DRY RUN: Would assign thread",
                        thread_id=thread_id,
                        agent_id=agent_id,
                    )
                else:
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
                            error=str(assign_result.error),
                        )
                    else:
                        log.info(
                            "Assigned thread",
                            thread_id=thread_id,
                            agent_id=agent_id,
                        )

                actioned += 1

    log.info(
        "Summary",
        threads_found=len(thread_ids),
        threads_processed=len(threads_limited),
        actioned=actioned,
        dry_run=dry_run,
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Assign unassigned Plain Ongoing Account Review threads (defaults to dry-run)"
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually assign threads (by default, runs in dry-run mode)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=1,
        help="Maximum number of threads to process (default: 1, use 0 for unlimited)",
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
        log.info("Use --execute to actually assign threads")
    else:
        log.warning("Running in EXECUTE mode - threads will be assigned!")

    log.info(
        "Processing settings",
        limit=args.limit if args.limit > 0 else "unlimited",
        dry_run=dry_run,
    )

    try:
        asyncio.run(
            process_threads(
                dry_run=dry_run,
                limit=args.limit,
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
